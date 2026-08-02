/**
 * Freebie downloads, gated behind an email subscription.
 *
 * The files live in a Storage folder with `allow read: if false`, so the only
 * way to reach one is a signed URL minted here. Links expire, which means a
 * shared URL stops working rather than becoming a permanent bypass of the gate.
 */
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

/** How long a download link stays valid. Long enough to click, short enough
 *  that a forwarded link is useless by the time it travels. */
const LINK_TTL_MS = 15 * 60 * 1000;

/** Server-side email validation. Mirrors the client check, but authoritative. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

/**
 * A subscriber doc id derived from the email, so the same address cannot
 * create duplicate records and "already subscribed" is a simple existence
 * check. Firestore ids cannot contain '/', and '@' and '.' are legal but
 * awkward, so both are replaced.
 */
export const subscriberId = (email: string) =>
  normalizeEmail(email).replace(/[^a-z0-9]/g, '_').slice(0, 400);

export type SubscribeResult = {
  status: 'subscribed' | 'already-subscribed';
  downloadUrl: string;
  fileName: string;
  expiresInMinutes: number;
};

/**
 * Record the subscription (if new) and return a signed download link.
 *
 * Returns the same link either way: someone who already subscribed should not
 * be locked out of a resource they have already earned. The status field lets
 * the UI say "thanks, you're already subscribed" rather than implying a new
 * signup.
 */
export async function subscribeAndSign(
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

  const filePath = String(freebie.get('filePath') ?? '').trim();
  if (!filePath) {
    logger.error('Freebie has no filePath', { slug });
    throw new HttpsError('failed-precondition', 'That download is not ready yet.');
  }

  // Record the subscriber before handing over the file, so a failure to store
  // the email cannot silently give away the download for free.
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

  const file = admin.storage().bucket().file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    logger.error('Freebie file missing from storage', { slug, filePath });
    throw new HttpsError('not-found', 'That file is missing. Please contact us.');
  }

  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + LINK_TTL_MS,
  });

  // Best effort: a failed counter must not cost the visitor their download.
  try {
    await freebie.ref.update({ downloads: admin.firestore.FieldValue.increment(1) });
  } catch (error) {
    logger.warn('Could not increment freebie downloads', error);
  }

  return {
    status: alreadySubscribed ? 'already-subscribed' : 'subscribed',
    downloadUrl,
    fileName: filePath.split('/').pop() || 'download',
    expiresInMinutes: Math.round(LINK_TTL_MS / 60000),
  };
}
