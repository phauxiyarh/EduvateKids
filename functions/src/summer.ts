/**
 * Summer Reading Program: server-side integrity.
 *  - registerSummerReader: creates a registration with a guaranteed-unique code.
 *  - logSummerBook: validates the code, appends a parent-verified book, and
 *    recomputes booksCount + goalMet server-side (client can't inflate counts).
 *
 * Levels are CHOSEN at registration and are FIXED: each level's book count is
 * that reader's goal. Logging more books beyond the goal is welcomed (bonus
 * reading), but it NEVER moves a reader into a different level/category. Reaching
 * the goal marks the level "achieved"; readers may keep logging after that.
 *
 * Levels (book goal): Early Readers/Seedlings 4, Growing Readers 6, Confident Readers/Scholar 10.
 */
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { sendReaderWelcome } from './email';

/** The three reading levels and the book goal for each. */
export const LEVELS = { seedling: 4, reader: 6, scholar: 10 } as const;

/** A reader's chosen level. 'none' only exists for legacy docs. */
export type SummerLevel = 'none' | 'seedling' | 'reader' | 'scholar';

/** Back-compat alias for older callers/imports. */
export type SummerTier = SummerLevel;
export const TIERS = LEVELS;

/** Normalise an arbitrary input to a valid chosen level (defaults to seedling). */
export function normalizeLevel(input: unknown): Exclude<SummerLevel, 'none'> {
  const v = String(input ?? '').trim().toLowerCase();
  if (v === 'scholar') return 'scholar';
  if (v === 'reader') return 'reader';
  return 'seedling';
}

/** The book goal for a chosen level. */
export function goalForLevel(level: SummerLevel): number {
  if (level === 'scholar') return LEVELS.scholar;
  if (level === 'reader') return LEVELS.reader;
  if (level === 'seedling') return LEVELS.seedling;
  return LEVELS.seedling;
}

/** Friendly display name for a level (used in the welcome email). */
export function levelDisplayName(level: SummerLevel): string {
  if (level === 'scholar') return 'Confident Readers';
  if (level === 'reader') return 'Growing Readers';
  return 'Early Readers';
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
  level?: string; // chosen reading level (seedling | reader | scholar); fixed after registration
  country?: string;
  state?: string;
  city?: string;
}

/**
 * The raffle prize draw is currently open only to residents of the USA,
 * Nigeria, or Canada. Everyone may still register, read, and earn a certificate,
 * this flag only governs prize-draw eligibility. Matches common
 * spellings/aliases.
 */
export const RAFFLE_ELIGIBLE_COUNTRIES = [
  'united states', 'usa', 'us', 'united states of america',
  'nigeria', 'ng',
  'canada', 'ca',
];
export function isRaffleEligible(country: unknown): boolean {
  const c = String(country ?? '').trim().toLowerCase();
  return RAFFLE_ELIGIBLE_COUNTRIES.includes(c);
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
  const level = normalizeLevel(input.level);
  const goal = goalForLevel(level);
  const country = String(input.country ?? '').trim();
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
      // Location (persisted so the admin can verify raffle eligibility).
      country,
      state: String(input.state ?? '').trim(),
      city: String(input.city ?? '').trim(),
      // Raffle draw is currently open only to USA / Nigeria residents.
      raffleEligible: isRaffleEligible(country),
      consent: Boolean(input.consent),
      booksLogged: [],
      booksCount: 0,
      // Chosen level is fixed; goal is its book target; goalMet is derived.
      level,
      goal,
      goalMet: false,
      // `tier` mirrors the chosen level for back-compat with existing dashboards.
      tier: level as SummerTier,
      _live: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  logger.info('Summer reader registered', { code, level, country });

  // Warm welcome email to the parent with the reading code. Self-catches and
  // never throws, so a mail hiccup can't fail the registration.
  await sendReaderWelcome({
    parentName: input.parentName,
    parentEmail: input.parentEmail,
    childName: input.childName,
    code,
    levelName: levelDisplayName(level),
    goal,
  });

  return { code };
}

/**
 * Re-send the warm welcome email to a parent who already registered, used by an
 * admin "Resend welcome" button for readers who signed up before the welcome
 * email existed (or who never received it). Looks the reader up by code, pulls
 * the details already on file, and re-sends. Never mutates the record.
 */
export async function resendReaderWelcome(
  db: FirebaseFirestore.Firestore,
  code: string
): Promise<{ sent: true; parentEmail: string }> {
  const ref = db.collection('summerReads').doc(code.trim().toUpperCase());
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Code not found.');
  const data = snap.data() as {
    childName?: string;
    parentName?: string;
    parentEmail?: string;
    level?: unknown;
    tier?: unknown;
    goal?: number;
  };
  const parentEmail = String(data.parentEmail ?? '').trim();
  if (!parentEmail) throw new Error('This reader has no parent email on file.');
  const level = resolveLevel(data);
  await sendReaderWelcome({
    parentName: String(data.parentName ?? '').trim() || 'there',
    parentEmail,
    childName: String(data.childName ?? '').trim() || 'your child',
    code: snap.id,
    levelName: levelDisplayName(level),
    goal: typeof data.goal === 'number' ? data.goal : goalForLevel(level),
  });
  logger.info('Reader welcome email re-sent', { code: snap.id });
  return { sent: true, parentEmail };
}

/**
 * Resolve a registration's FIXED level. Prefers the explicit `level` field;
 * falls back to a legacy `tier` value; defaults to seedling. Never derived from
 * the book count, the chosen level does not change when books are logged.
 */
function resolveLevel(data: { level?: unknown; tier?: unknown }): Exclude<SummerLevel, 'none'> {
  const raw = data.level ?? data.tier;
  return normalizeLevel(raw === 'none' ? 'seedling' : raw);
}

/**
 * A book counts towards the reading goal ONLY if it has NOT been marked invalid
 * by an admin. Books logged before this feature (no `valid` field) count as
 * valid, an admin must explicitly flag one invalid to exclude it. This is the
 * single source of truth for "how many books count", used everywhere the goal
 * is (re)computed so an admin's silent review of an off-list book immediately
 * affects the reader's progress and raffle eligibility.
 */
function isValidBook(b: unknown): boolean {
  return (b as { valid?: unknown })?.valid !== false;
}
function countValidBooks(logged: unknown[]): number {
  return logged.reduce<number>((n, b) => n + (isValidBook(b) ? 1 : 0), 0);
}

export async function logBook(
  db: FirebaseFirestore.Firestore,
  input: LogBookInput
): Promise<{ booksCount: number; level: SummerLevel; goal: number; goalMet: boolean; goalJustMet: boolean }> {
  const ref = db.collection('summerReads').doc(input.code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found. Please check the code and try again.');
    const data = snap.data() as { booksLogged?: unknown[]; level?: unknown; tier?: unknown; goalMet?: boolean; parentEmail?: string };
    assertOwnsCode(data, input.parentEmail);
    const level = resolveLevel(data);
    const goal = goalForLevel(level);
    const wasGoalMet = Boolean(data.goalMet);
    const logged = Array.isArray(data.booksLogged) ? data.booksLogged : [];
    const rating = Math.max(0, Math.min(5, Math.round(Number(input.rating) || 0)));
    const entry = {
      title: input.title.trim(),
      author: (input.author || '').trim(),
      rating,
      review: (input.review || '').trim().slice(0, 500),
      dateFinished: (input.dateFinished || '').trim() || new Date().toISOString().split('T')[0],
      parentVerified: true,
      // New books count towards the goal by default; an admin may later flag an
      // off-list book invalid (silent review), which drops it from the count.
      valid: true,
      dateLogged: new Date().toISOString(),
    };
    const nextLogged = [...logged, entry];
    // Only admin-VALID books count towards the goal (and thus raffle eligibility).
    const booksCount = countValidBooks(nextLogged);
    const goalMet = booksCount >= goal;
    tx.update(ref, {
      booksLogged: nextLogged,
      booksCount,
      // level/goal are fixed, re-write them so legacy docs get backfilled too.
      level,
      goal,
      goalMet,
      tier: level as SummerTier,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // goalJustMet: they crossed their own goal on THIS log (for the celebration).
    return { booksCount, level, goal, goalMet, goalJustMet: goalMet && !wasGoalMet };
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

/** Edit a previously-logged book at a given index. Level/goal are unchanged. */
export async function editBook(
  db: FirebaseFirestore.Firestore,
  input: EditBookInput
): Promise<{ booksCount: number; level: SummerLevel; goal: number; goalMet: boolean }> {
  const ref = db.collection('summerReads').doc(input.code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { booksLogged?: Record<string, unknown>[]; level?: unknown; tier?: unknown; parentEmail?: string };
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
    const level = resolveLevel(data);
    const goal = goalForLevel(level);
    const booksCount = countValidBooks(logged);
    const goalMet = booksCount >= goal;
    tx.update(ref, { booksLogged: logged, booksCount, level, goal, goalMet, tier: level as SummerTier, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { booksCount, level, goal, goalMet };
  });
}

/**
 * ADMIN-ONLY: silently mark a logged book valid or invalid. Off-list books an
 * admin spots during review can be flagged invalid so they DON'T count towards
 * the reading goal / raffle eligibility, without notifying or involving the
 * parent (no ownership check; this is an admin action, gated by the callable's
 * admin check). Recomputes booksCount + goalMet from the remaining valid books.
 */
export async function setBookValidity(
  db: FirebaseFirestore.Firestore,
  code: string,
  index: number,
  valid: boolean
): Promise<{ booksCount: number; level: SummerLevel; goal: number; goalMet: boolean; valid: boolean }> {
  const ref = db.collection('summerReads').doc(code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { booksLogged?: Record<string, unknown>[]; level?: unknown; tier?: unknown };
    const logged = Array.isArray(data.booksLogged) ? [...data.booksLogged] : [];
    if (index < 0 || index >= logged.length) throw new Error('Book entry not found.');
    logged[index] = { ...logged[index], valid };
    const level = resolveLevel(data);
    const goal = goalForLevel(level);
    const booksCount = countValidBooks(logged);
    const goalMet = booksCount >= goal;
    tx.update(ref, { booksLogged: logged, booksCount, level, goal, goalMet, tier: level as SummerTier, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { booksCount, level, goal, goalMet, valid };
  });
}

/**
 * ADMIN-ONLY: manually set (or clear) a reader's raffle-eligibility override.
 * By default eligibility is derived from the reader's country
 * (isRaffleEligible). This lets an admin force a reader eligible or ineligible
 * regardless of country, e.g. a verified resident whose country text didn't
 * match. `eligible` writes the boolean override; `null` clears it, reverting to
 * the country-derived default (which we recompute and re-store as raffleEligible).
 */
export async function setReaderEligibility(
  db: FirebaseFirestore.Firestore,
  code: string,
  eligible: boolean | null
): Promise<{ raffleEligible: boolean; overridden: boolean }> {
  const ref = db.collection('summerReads').doc(code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { country?: unknown };
    if (eligible === null) {
      // Clear the override; fall back to the country-derived value.
      const derived = isRaffleEligible(data.country);
      tx.update(ref, {
        raffleEligible: derived,
        raffleEligibleOverride: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { raffleEligible: derived, overridden: false };
    }
    tx.update(ref, {
      raffleEligible: eligible,
      raffleEligibleOverride: eligible,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { raffleEligible: eligible, overridden: true };
  });
}

/** Delete a logged book at a given index; recompute count + goalMet (level is fixed). */
export async function deleteBook(
  db: FirebaseFirestore.Firestore,
  code: string,
  index: number,
  parentEmail: string
): Promise<{ booksCount: number; level: SummerLevel; goal: number; goalMet: boolean }> {
  const ref = db.collection('summerReads').doc(code.trim().toUpperCase());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Code not found.');
    const data = snap.data() as { booksLogged?: unknown[]; level?: unknown; tier?: unknown; parentEmail?: string };
    assertOwnsCode(data, parentEmail);
    const logged = Array.isArray(data.booksLogged) ? [...data.booksLogged] : [];
    if (index < 0 || index >= logged.length) throw new Error('Book entry not found.');
    logged.splice(index, 1);
    const level = resolveLevel(data);
    const goal = goalForLevel(level);
    const booksCount = countValidBooks(logged);
    const goalMet = booksCount >= goal;
    tx.update(ref, { booksLogged: logged, booksCount, level, goal, goalMet, tier: level as SummerTier, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { booksCount, level, goal, goalMet };
  });
}
