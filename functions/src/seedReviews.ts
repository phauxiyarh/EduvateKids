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

  for (const row of SEED) {
    const ref = db.collection('reviews').doc(row.id);
    // Never resurrect a review the admin has already dealt with.
    if ((await ref.get()).exists) {
      skipped += 1;
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
    created += 1;
  }

  logger.info('Seeded testimonials', { created, skipped });
  return { created, skipped };
}
