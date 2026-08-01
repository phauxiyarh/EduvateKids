/**
 * Rebuilding the static site when the catalog changes.
 *
 * Product pages (/book/<slug>) are generated at build time from the `catalog`
 * collection, so a book added in the dashboard has no page until the site is
 * rebuilt. These helpers fire the GitHub Actions deploy workflow via
 * repository_dispatch so that happens without anyone pushing a commit.
 *
 * Two entry points, both landing here:
 *   - onCatalogWrite  : automatic, debounced, fires after a quiet period
 *   - requestPublish  : the dashboard "Publish now" button, immediate
 */
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

/** Repo hosting the site and its deploy workflow. */
const GITHUB_OWNER = 'phauxiyarh';
const GITHUB_REPO = 'EduvateKids';

/**
 * How long the catalog must be quiet before an automatic build fires. Editing
 * a batch of books should produce one build, not one per edit.
 */
export const DEBOUNCE_MS = 10 * 60 * 1000;

/** Minimum gap between builds, so a burst of manual clicks cannot stack them. */
const MIN_BUILD_GAP_MS = 5 * 60 * 1000;

/** Single doc tracking publish state. Also read by the dashboard for its badge. */
const STATE_DOC = 'system/publishState';

export type PublishState = {
  /** Last time a catalog document changed. */
  lastCatalogChangeAt?: FirebaseFirestore.Timestamp;
  /** Last time we successfully asked GitHub to build. */
  lastDispatchAt?: FirebaseFirestore.Timestamp;
  /** Why the last build was requested. */
  lastDispatchReason?: 'auto' | 'manual';
  /** Set when a dispatch fails, cleared on the next success. */
  lastError?: string | null;
}

/**
 * POST a repository_dispatch to GitHub. Returns nothing on success and throws
 * with a useful message on failure — callers decide whether that is fatal.
 */
async function dispatchBuild(token: string, reason: 'auto' | 'manual'): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'publish-catalog',
        client_payload: { reason, requestedAt: new Date().toISOString() },
      }),
    },
  );

  // GitHub returns 204 No Content on success.
  if (res.status !== 204) {
    const body = await res.text();
    throw new Error(`GitHub dispatch failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Record that the catalog changed. Cheap: one write per catalog edit, no
 * network call. The scheduled sweep below decides when to actually build.
 */
export async function noteCatalogChange(db: FirebaseFirestore.Firestore): Promise<void> {
  await db.doc(STATE_DOC).set(
    { lastCatalogChangeAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/**
 * Fire a build if the catalog has been quiet for DEBOUNCE_MS and we have not
 * already built since the last change. Called on a schedule rather than from
 * the write trigger itself, so a burst of edits collapses into one build.
 */
export async function publishIfDue(
  db: FirebaseFirestore.Firestore,
  token: string,
): Promise<'built' | 'not-due' | 'no-changes'> {
  const snap = await db.doc(STATE_DOC).get();
  const state = (snap.data() ?? {}) as PublishState;

  const changedAt = state.lastCatalogChangeAt?.toMillis();
  if (!changedAt) return 'no-changes';

  const dispatchedAt = state.lastDispatchAt?.toMillis() ?? 0;
  // Already built since the last change — nothing pending.
  if (dispatchedAt >= changedAt) return 'no-changes';

  // Still inside the quiet period; let more edits land first.
  if (Date.now() - changedAt < DEBOUNCE_MS) return 'not-due';

  await dispatchBuild(token, 'auto');
  await db.doc(STATE_DOC).set(
    {
      lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDispatchReason: 'auto',
      lastError: null,
    },
    { merge: true },
  );
  logger.info('Catalog build dispatched (auto)');
  return 'built';
}

/**
 * Immediate build for the dashboard button. Rate-limited so repeated clicks
 * cannot queue up builds; returns a structured result the UI can explain.
 */
export async function publishNow(
  db: FirebaseFirestore.Firestore,
  token: string,
): Promise<{ status: 'dispatched' | 'throttled'; retryAfterSeconds?: number }> {
  const snap = await db.doc(STATE_DOC).get();
  const state = (snap.data() ?? {}) as PublishState;

  const since = Date.now() - (state.lastDispatchAt?.toMillis() ?? 0);
  if (since < MIN_BUILD_GAP_MS) {
    return {
      status: 'throttled',
      retryAfterSeconds: Math.ceil((MIN_BUILD_GAP_MS - since) / 1000),
    };
  }

  try {
    await dispatchBuild(token, 'manual');
  } catch (error) {
    // Surface the failure in the state doc so the dashboard can show it
    // rather than leaving the admin guessing why nothing happened.
    await db.doc(STATE_DOC).set(
      { lastError: (error as Error).message.slice(0, 500) },
      { merge: true },
    );
    throw error;
  }

  await db.doc(STATE_DOC).set(
    {
      lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDispatchReason: 'manual',
      lastError: null,
    },
    { merge: true },
  );
  logger.info('Catalog build dispatched (manual)');
  return { status: 'dispatched' };
}
