import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicCollection, SITE_URL } from '../../lib/catalogBuild'
import { normalizeBlogPost, sortPosts } from '../../lib/blog'
import BlogListClient from './PageClient'

export const metadata: Metadata = {
  title: 'Reading Guides & Articles',
  description:
    'Practical guides for raising readers: choosing age-appropriate Islamic books, building reading habits, Ramadan routines and more from Eduvate Kids.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Reading Guides & Articles | Eduvate Kids',
    description:
      'Practical guides for raising readers, from choosing books to building habits.',
    url: '/blog',
    type: 'website'
  }
}

export default async function Page() {
  const docs = await getPublicCollection('blog')
  const posts = docs
    .map((d) => normalizeBlogPost(d, d.id))
    .filter((p) => p.published && p.title)
    .sort(sortPosts)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Eduvate Kids blog',
    url: `${SITE_URL}/blog`,
    publisher: { '@id': `${SITE_URL}/#organization` },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.excerpt || undefined,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt || undefined,
      author: { '@type': 'Person', name: p.author },
      ...(p.images.length ? { image: p.images[0] } : {})
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogListClient posts={posts} />
      {/* Crawlable index: the cards above are interactive, this keeps every
          title, summary and link in the static HTML. */}
      <nav aria-label="All articles" className="sr-only">
        <h2>All {posts.length} articles</h2>
        <ul>
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/blog/${p.slug}`}>{p.title}</Link>
              {p.excerpt && <span> {p.excerpt}</span>}
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
