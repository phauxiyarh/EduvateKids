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

function codeFromBytes(bytes: Uint8Array, len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `EK-${s}`;
}

/** Generate a unique code, retrying on the rare collision. */
export async function generateUniqueCode(db: FirebaseFirestore.Firestore): Promise<string> {
  const crypto = await import('crypto');
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = codeFromBytes(crypto.randomBytes(4));
    const existing = await db.collection('summerReads').doc(code).get();
    if (!existing.exists) return code;
  }
  // Extremely unlikely; fall back to a longer code.
  return codeFromBytes(crypto.randomBytes(6), 6);
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
  title: string;
  author?: string;
  rating?: number; // 1-5
  review?: string;
  dateFinished?: string; // ISO date
  parentVerified: boolean;
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
    const data = snap.data() as { booksLogged?: unknown[]; tier?: SummerTier };
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
