/**
 * Freebie downloads, revealed after an email subscription.
 *
 * The files live on Google Drive rather than in our Storage, so there is
 * nothing to sign. Returning the URL from a function instead of embedding it
 * in the page keeps it out of the static HTML, which means it is not indexed
 * and not visible in "view source" without subscribing first.
 *
 * That is a reveal, not an enforcement: a visitor who has the link can pass it
 * on. Accepted deliberately for free printables, in exchange for zero storage
 * cost and the admin keeping the documents where they already are.
 */
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

/**
 * Subscriber doc id derived from the email, so the same address cannot create
 * duplicate records and "already subscribed" is a simple existence check.
 */
export const subscriberId = (email: string) =>
  normalizeEmail(email).replace(/[^a-z0-9]/g, '_').slice(0, 400);

export type SubscribeResult = {
  status: 'subscribed' | 'already-subscribed';
  downloadUrl: string;
  title: string;
};

/**
 * Record the subscription (if new) and return the download link.
 *
 * Returns the link either way. Someone who subscribed last month should not be
 * refused a resource they already qualify for; the status field just lets the
 * UI say "you're already subscribed, thank you" rather than implying a new
 * signup.
 */
export async function subscribeAndReveal(
  db: FirebaseFirestore.Firestore,
  rawEmail: unknown,
  slug: string,
  source: string
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.');
  }
  if (!slug) {
    throw new HttpsError('invalid-argument', 'A freebie is required.');
  }

  const matches = await db.collection('freebies').where('slug', '==', slug).limit(1).get();
  if (matches.empty) {
    throw new HttpsError('not-found', 'That freebie is not available.');
  }
  const freebie = matches.docs[0];
  if (freebie.get('active') === false) {
    throw new HttpsError('not-found', 'That freebie is not available.');
  }

  const fileUrl = String(freebie.get('fileUrl') ?? '').trim();
  if (!/^https?:\/\//i.test(fileUrl)) {
    logger.error('Freebie has no usable fileUrl', { slug });
    throw new HttpsError('failed-precondition', 'That download is not ready yet.');
  }

  // Record the subscriber before handing over the link, so a failure to store
  // the email cannot silently give the download away for nothing.
  const ref = db.collection('subscribers').doc(subscriberId(email));
  const existing = await ref.get();
  const alreadySubscribed = existing.exists;

  if (alreadySubscribed) {
    await ref.update({
      lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
      freebies: admin.firestore.FieldValue.arrayUnion(slug),
    });
  } else {
    await ref.set({
      email,
      source,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
      freebies: [slug],
    });
  }

  // Best effort: a failed counter must not cost the visitor their download.
  try {
    await freebie.ref.update({ downloads: admin.firestore.FieldValue.increment(1) });
  } catch (error) {
    logger.warn('Could not increment freebie downloads', error);
  }

  return {
    status: alreadySubscribed ? 'already-subscribed' : 'subscribed',
    downloadUrl: fileUrl,
    title: String(freebie.get('title') ?? 'your download'),
  };
}
