/**
 * Customer review submission.
 *
 * Public and unauthenticated by design: the point is to let a customer leave a
 * review without creating an account. Everything arrives here rather than going
 * straight to Firestore so that:
 *
 *  - `approved` is set by us, always false. Rules make the field unwritable by
 *    clients anyway, but keeping the write path server-side means there is only
 *    one place that decides what "published" means.
 *  - The text is length-capped and stripped of control characters before it is
 *    stored, so the admin list and the public page cannot be wrecked by a paste.
 *  - Repeat submissions from one person are rate-limited.
 *
 * The review is invisible on the site until an admin approves it.
 */
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';

const MAX_QUOTE = 1200;
const MAX_NAME = 80;
const MAX_ROLE = 80;

/** No more than this many submissions from one IP in the window below. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export type SubmitReviewInput = {
  name?: unknown;
  role?: unknown;
  rating?: unknown;
  quote?: unknown;
  email?: unknown;
};

/**
 * Strip control characters and collapse runaway whitespace, then cap the
 * length. Newlines survive because a review may have paragraphs.
 */
function clean(value: unknown, limit: number): string {
  return String(value ?? '')
    // Drop C0/C1 control characters but keep newlines so paragraphs survive.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

const clampRating = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
};

/**
 * Count recent submissions from this IP.
 *
 * The IP is not on the review doc (that doc is publicly readable once approved),
 * so this reads the flat `reviewSubmissions` log instead: one small doc per
 * submission, admin-only, holding just the IP and a timestamp.
 */
async function assertNotFlooding(
  db: FirebaseFirestore.Firestore,
  ip: string,
): Promise<void> {
  if (!ip) return;
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const recent = await db
    .collection('reviewSubmissions')
    .where('ip', '==', ip)
    .where('at', '>=', since)
    .limit(RATE_LIMIT)
    .get();
  if (recent.size >= RATE_LIMIT) {
    throw new HttpsError(
      'resource-exhausted',
      'You have left several reviews recently. Please try again later.',
    );
  }
}

/**
 * Validate and store one review, unapproved. Returns the new id so the form can
 * show a confirmation.
 */
export async function submitReview(
  db: FirebaseFirestore.Firestore,
  input: SubmitReviewInput,
  ip: string,
): Promise<{ id: string; status: 'pending' }> {
  const name = clean(input.name, MAX_NAME);
  const role = clean(input.role, MAX_ROLE);
  const quote = clean(input.quote, MAX_QUOTE);
  const email = clean(input.email, 200).toLowerCase();
  const rating = clampRating(input.rating);

  if (name.length < 2) {
    throw new HttpsError('invalid-argument', 'Please tell us your name.');
  }
  if (quote.length < 10) {
    throw new HttpsError(
      'invalid-argument',
      'Please write a little more about your experience.',
    );
  }
  if (!rating) {
    throw new HttpsError('invalid-argument', 'Please choose a star rating from 1 to 5.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpsError('invalid-argument', 'That email address does not look right.');
  }

  await assertNotFlooding(db, ip);

  const now = new Date().toISOString();

  // Only publishable fields go on the review doc: rules can hide a document but
  // not a field, and an approved review is world-readable. The reviewer's email
  // must therefore never live here.
  const ref = await db.collection('reviews').add({
    name,
    role,
    rating,
    quote,
    // Set here, never from the client: a review is published only once an admin
    // approves it in the dashboard.
    approved: false,
    featured: false,
    source: 'customer',
    createdAt: now,
    updatedAt: now,
  });

  // Contact details, in an admin-only subcollection. The form promises the email
  // is not published, and this is what keeps that true.
  if (email) {
    await ref.collection('private').doc('contact').set({ email, at: now });
  }

  // Abuse log for the rate limiter above. Separate from the review so deleting a
  // review does not reopen the window.
  await db.collection('reviewSubmissions').add({ ip, at: now, reviewId: ref.id });

  logger.info('Review submitted', { id: ref.id, rating });
  return { id: ref.id, status: 'pending' };
}
