/**
 * One-time import of the original hardcoded testimonials.
 *
 * Six quotes used to live in app/PageClient.tsx as a fallback for an empty
 * reviews collection. They rendered on the home page but existed nowhere in
 * Firestore, so the admin could not edit or delete them: the site showed
 * testimonials the dashboard did not know about.
 *
 * This writes them in as ordinary approved reviews, after which the hardcoded
 * copy is removed and the reviews collection is the only source of testimonials.
 *
 * Admin-only and idempotent: each row has a fixed document id, so running it
 * twice overwrites rather than duplicates, and a review the admin has since
 * edited or deleted is left alone.
 */
import * as logger from 'firebase-functions/logger';

/** Fixed ids so a re-run cannot create a second copy of the same quote. */
const SEED = [
  {
    id: 'seed-amina-m',
    quote:
      'My 5-year-old keeps asking for story time now. We found books that speak to her faith in a gentle, joyful way.',
    name: 'Amina M.',
    role: 'Parent of a kindergartener',
  },
  {
    id: 'seed-mr-hassan',
    quote:
      'Our 4th graders were captivated by the biographies and activity kits. The fair felt thoughtful and well curated.',
    name: 'Mr. Hassan',
    role: 'Elementary School Librarian',
  },
  {
    id: 'seed-zara-9',
    quote:
      'I love the puzzles and the stories. The heroes are brave and kind. I read to my little brother too.',
    name: 'Zara, 9',
    role: 'Young Reader',
  },
  {
    id: 'seed-khalid-14',
    quote:
      'As a teen, I wanted books that felt like real life. The selections here are thoughtful and inspiring.',
    name: 'Khalid, 14',
    role: 'Middle School Student',
  },
  {
    id: 'seed-sana-r',
    quote:
      'The Arabic flashcards and seerah sets made our homeschooling routine smoother and more meaningful.',
    name: 'Sana R.',
    role: 'Homeschooling Parent',
  },
  {
    id: 'seed-lina-11',
    quote:
      'I discovered books that helped me feel confident at the masjid and at school. It made a real difference.',
    name: 'Lina, 11',
    role: 'Young Reader',
  },
];

export async function seedReviews(
  db: FirebaseFirestore.Firestore,
): Promise<{ created: number; skipped: number }> {
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  // A deleted review leaves no trace, so an existence check alone cannot tell
  // "never imported" from "imported, then deliberately deleted" - and re-running
  // the import would resurrect something the admin removed on purpose. This doc
  // records which ids have ever been written, which is the difference.
  const ledgerRef = db.doc('system/seededReviews');
  const everSeeded = new Set<string>(
    ((await ledgerRef.get()).get('ids') as string[] | undefined) ?? [],
  );

  for (const row of SEED) {
    if (everSeeded.has(row.id)) {
      // Already imported once. Whether it still exists or the admin has since
      // deleted it, importing again is not what they want.
      skipped += 1;
      continue;
    }
    const ref = db.collection('reviews').doc(row.id);
    if ((await ref.get()).exists) {
      skipped += 1;
      everSeeded.add(row.id);
      continue;
    }
    await ref.set({
      name: row.name,
      role: row.role,
      quote: row.quote,
      rating: 5,
      approved: true,
      featured: false,
      // Marked as ours, not a customer submission, so the admin list is honest
      // about where these came from.
      source: 'admin',
      createdAt: now,
      updatedAt: now,
    });
    everSeeded.add(row.id);
    created += 1;
  }

  await ledgerRef.set({ ids: [...everSeeded], updatedAt: now }, { merge: true });

  logger.info('Seeded testimonials', { created, skipped });
  return { created, skipped };
}
