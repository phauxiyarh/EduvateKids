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
import { createHash } from 'crypto';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

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
 *
 * One document per IP, keyed by a hash of it, holding the timestamps of that
 * IP's recent submissions. A single get() by key: no composite query, and so no
 * index to deploy alongside the function. An `ip == x AND at >= y` query needs
 * one, and shipping the function without it made every submission fail.
 *
 * Rate limiting must never be the reason a genuine review is lost, so a failure
 * to read the log lets the submission through rather than rejecting it.
 */
async function assertNotFlooding(
  db: FirebaseFirestore.Firestore,
  ip: string,
): Promise<FirebaseFirestore.DocumentReference | null> {
  if (!ip) return null;
  // Hashed so the raw address is not the document id.
  const key = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const ref = db.collection('reviewSubmissions').doc(key);

  let recent: number[] = [];
  try {
    const snap = await ref.get();
    const stored = snap.exists ? (snap.get('at') as unknown) : null;
    if (Array.isArray(stored)) {
      const cutoff = Date.now() - RATE_WINDOW_MS;
      recent = stored
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= cutoff);
    }
  } catch (error) {
    logger.warn('Rate-limit read failed; allowing the submission', error);
    return null;
  }

  if (recent.length >= RATE_LIMIT) {
    throw new HttpsError(
      'resource-exhausted',
      'You have left several reviews recently. Please try again later.',
    );
  }

  // Returned so the caller can record this submission only once it has actually
  // stored the review.
  return ref;
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

  const limiterRef = await assertNotFlooding(db, ip);

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

  // Record this submission against the IP for the rate limiter. Written only
  // after the review is safely stored, and never allowed to fail the request:
  // the review already exists, so throwing here would tell the customer their
  // review was lost when it was not.
  if (limiterRef) {
    try {
      await limiterRef.set(
        { at: FieldValue.arrayUnion(Date.now()) },
        { merge: true },
      );
    } catch (error) {
      logger.warn('Rate-limit write failed', error);
    }
  }

  logger.info('Review submitted', { id: ref.id, rating });
  return { id: ref.id, status: 'pending' };
}
