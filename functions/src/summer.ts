/**
 * Summer Reading Program — server-side integrity.
 *  - registerSummerReader: creates a registration with a guaranteed-unique code.
 *  - logSummerBook: validates the code, appends a parent-verified book, and
 *    recomputes booksCount + tier server-side (client can't inflate counts).
 *
 * Tiers (configurable defaults): Seedling 3, Reader 6, Scholar 10.
 */
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

export const TIERS = { seedling: 3, reader: 6, scholar: 10 } as const;

export type SummerTier = 'none' | 'seedling' | 'reader' | 'scholar';

export function tierFor(count: number): SummerTier {
  if (count >= TIERS.scholar) return 'scholar';
  if (count >= TIERS.reader) return 'reader';
  if (count >= TIERS.seedling) return 'seedling';
  return 'none';
}

/** Unambiguous code alphabet (no 0/O/1/I) → e.g. EK-7Q4M. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function codeFromBytes(bytes: Uint8Array, len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `EK-${s}`;
}

/**
 * Generate a unique 6-char code (32^6 ≈ 1.07 billion combos → brute-forcing a
 * valid code via repeated getDoc is impractical), retrying on the rare collision.
 */
export async function generateUniqueCode(db: FirebaseFirestore.Firestore): Promise<string> {
  const crypto = await import('crypto');
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = codeFromBytes(crypto.randomBytes(6));
    const existing = await db.collection('summerReads').doc(code).get();
    if (!existing.exists) return code;
  }
  // Extremely unlikely; fall back to an even longer code.
  return codeFromBytes(crypto.randomBytes(8), 8);
}

export interface RegisterInput {
  childName: string;
  dateOfBirth: string; // ISO date (yyyy-mm-dd)
  childAge?: number | null; // computed client-side; recomputed server-side for integrity
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  consent: boolean;
}

export interface LogBookInput {
  code: string;
  parentEmail: string; // must match the registration's parent email (ownership)
  title: string;
  author?: string;
  rating?: number; // 1-5
  review?: string;
  dateFinished?: string; // ISO date
  parentVerified: boolean;
}

/**
 * Ownership check: a book log may only be mutated by someone who supplies the
 * parent email used at registration. A bare code (which a code holder or a
 * leaked link would have) is NOT enough to edit/delete another family's log.
 * Case-insensitive; throws a clean "not authorised" error on mismatch.
 */
function assertOwnsCode(data: { parentEmail?: unknown }, providedEmail: string): void {
  const onFile = String(data.parentEmail ?? '').trim().toLowerCase();
  const given = String(providedEmail ?? '').trim().toLowerCase();
  if (!given || !onFile || given !== onFile) {
    throw new Error('not-authorized: the parent email does not match this code.');
  }
}

/** Server-side age from DOB (don't trust the client's number). */
function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export async function registerReader(
  db: FirebaseFirestore.Firestore,
  input: RegisterInput
): Promise<{ code: string }> {
  const code = await generateUniqueCode(db);
  await db
    .collection('summerReads')
    .doc(code)
    .set({
      code,
      childName: input.childName,
      dateOfBirth: input.dateOfBirth || '',
      childAge: ageFromDob(input.dateOfBirth),
      parentName: input.parentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone || '',
      consent: Boolean(input.consent),
      booksLogged: [],
      booksCount: 0,
      tier: 'none' as SummerTier,
      _live: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  logger.info('Summer reader registered', { code });
  return { code };
}

export async function logBook(
  db: FirebaseFirestore.Firestore,
  input: LogBookInput
): Promise<{ booksCount: number; tier: SummerTier; newTier: boolean }> {
  const ref = db.collection('summerReads').doc(input.code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found. Please check the code and try again.');
    const data = snap.data() as { booksLogged?: unknown[]; tier?: SummerTier; parentEmail?: string };
    assertOwnsCode(data, input.parentEmail);
    const prevTier = (data.tier ?? 'none') as SummerTier;
    const logged = Array.isArray(data.booksLogged) ? data.booksLogged : [];
    const rating = Math.max(0, Math.min(5, Math.round(Number(input.rating) || 0)));
    const entry = {
      title: input.title.trim(),
      author: (input.author || '').trim(),
      rating,
      review: (input.review || '').trim().slice(0, 500),
      dateFinished: (input.dateFinished || '').trim() || new Date().toISOString().split('T')[0],
      parentVerified: true,
      dateLogged: new Date().toISOString(),
    };
    const nextLogged = [...logged, entry];
    const booksCount = nextLogged.length;
    const tier = tierFor(booksCount);
    tx.update(ref, {
      booksLogged: nextLogged,
      booksCount,
      tier,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { booksCount, tier, newTier: tier !== prevTier && tier !== 'none' };
  });
}

export interface EditBookInput {
  code: string;
  parentEmail: string; // ownership check
  index: number;
  title: string;
  author?: string;
  rating?: number;
  review?: string;
  dateFinished?: string;
}

/** Edit a previously-logged book at a given index. Count/tier are unchanged (still 1 book). */
export async function editBook(
  db: FirebaseFirestore.Firestore,
  input: EditBookInput
): Promise<{ booksCount: number; tier: SummerTier }> {
  const ref = db.collection('summerReads').doc(input.code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { booksLogged?: Record<string, unknown>[]; parentEmail?: string };
    assertOwnsCode(data, input.parentEmail);
    const logged = Array.isArray(data.booksLogged) ? [...data.booksLogged] : [];
    if (input.index < 0 || input.index >= logged.length) throw new Error('Book entry not found.');
    const rating = Math.max(0, Math.min(5, Math.round(Number(input.rating) || 0)));
    logged[input.index] = {
      ...logged[input.index],
      title: input.title.trim(),
      author: (input.author || '').trim(),
      rating,
      review: (input.review || '').trim().slice(0, 500),
      dateFinished: (input.dateFinished || '').trim() || (logged[input.index].dateFinished as string) || new Date().toISOString().split('T')[0],
      parentVerified: true,
    };
    const booksCount = logged.length;
    const tier = tierFor(booksCount);
    tx.update(ref, { booksLogged: logged, booksCount, tier, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { booksCount, tier };
  });
}

/** Delete a logged book at a given index; recompute count + tier (tier can drop). */
export async function deleteBook(
  db: FirebaseFirestore.Firestore,
  code: string,
  index: number,
  parentEmail: string
): Promise<{ booksCount: number; tier: SummerTier }> {
  const ref = db.collection('summerReads').doc(code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { booksLogged?: unknown[]; parentEmail?: string };
    assertOwnsCode(data, parentEmail);
    const logged = Array.isArray(data.booksLogged) ? [...data.booksLogged] : [];
    if (index < 0 || index >= logged.length) throw new Error('Book entry not found.');
    logged.splice(index, 1);
    const booksCount = logged.length;
    const tier = tierFor(booksCount);
    tx.update(ref, { booksLogged: logged, booksCount, tier, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { booksCount, tier };
  });
}
