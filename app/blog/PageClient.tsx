'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { BlogPost } from '../../lib/blog'
import { readingMinutes } from '../../lib/blog'
import { readLikedSlugs } from '../../lib/likes'
import { ImageSlider } from '../components/ImageSlider'
import { SiteHeader } from '../components/SiteChrome'
import { SiteFooterFull } from '../components/SiteFooterFull'

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Heart with the live count, filled when this browser has already liked. */
function LikeBadge({ likes, liked }: { likes: number; liked: boolean }) {
  if (likes <= 0 && !liked) return null
  return (
    <span
      className={`inline-flex items-center gap-1 ${liked ? 'text-secondary' : 'text-muted'}`}
      title={liked ? 'You have already liked this article' : undefined}
    >
      <svg
        className="h-3.5 w-3.5"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.35-9.6-8.4A5.4 5.4 0 0112 5.6a5.4 5.4 0 019.6 7C19.5 16.65 12 21 12 21z" />
      </svg>
      {likes}
      {liked && <span className="sr-only">You have already liked this article</span>}
    </span>
  )
}

function ArticleFallback({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-primary/10 via-cream to-secondary/10 ${className}`}>
      <svg className="h-14 w-14 text-primary/25" fill="none" stroke="currentColor" strokeWidth={1.25} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  )
}

function PostCard({
  post,
  likes,
  liked,
  latest = false
}: {
  post: BlogPost
  likes: number
  liked: boolean
  /** Badges the newest article. Marks it without changing the card's shape. */
  latest?: boolean
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-[0_18px_45px_-20px_rgba(124,58,237,0.4)]">
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden">
          {post.images.length ? (
            <ImageSlider images={post.images} alt={post.title} className="h-full w-full" />
          ) : (
            <ArticleFallback className="h-full w-full" />
          )}
          {post.tags[0] && (
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primaryDark shadow backdrop-blur">
              {post.tags[0]}
            </span>
          )}
          {latest && (
            <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-primary to-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow">
              Latest
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          {/* One line only: a wrapping meta row would push the title down and
              make this card taller than its neighbours. */}
          <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] font-semibold text-muted">
            <span className="shrink-0">{formatDate(post.publishedAt)}</span>
            <span aria-hidden="true" className="shrink-0">&middot;</span>
            <span className="shrink-0">{readingMinutes(post.body)} min read</span>
            <LikeBadge likes={likes} liked={liked} />
          </div>

          {/* Fixed heights rather than clamps alone: line-clamp caps the
              maximum but a short title still collapses, so cards in the same
              row would end at different places. Reserving two title lines and
              three excerpt lines makes every card identical whatever the text
              length, and the image ratio above is already locked. */}
          <h2 className="mt-2.5 line-clamp-2 h-[3.5rem] font-display text-lg font-bold leading-snug text-primaryDark transition-colors duration-300 group-hover:text-primary">
            {post.title}
          </h2>
          <p className="mt-2 line-clamp-3 h-[3.9rem] text-sm leading-relaxed text-muted">
            {post.excerpt}
          </p>

          {/* Pushes "Read more" to the foot of every card. */}
          <span className="flex-1" aria-hidden="true" />

          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primaryDark transition-all duration-300 group-hover:gap-2.5 group-hover:text-primary">
            Read more
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>
    </article>
  )
}

export default function BlogListClient({ posts }: { posts: BlogPost[] }) {
  const [tag, setTag] = useState<string>('all')
  const [likedSlugs, setLikedSlugs] = useState<string[]>([])
  // Build-time counts as the starting point, replaced by live values below so
  // the list does not show a stale number until the next deploy.
  const [liveLikes, setLiveLikes] = useState<Record<string, number>>({})

  useEffect(() => setLikedSlugs(readLikedSlugs()), [])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'blog'),
      (snap) => {
        const next: Record<string, number> = {}
        snap.forEach((d) => {
          const slug = String(d.get('slug') ?? '')
          const value = Number(d.get('likes'))
          if (slug && Number.isFinite(value)) next[slug] = Math.max(0, value)
        })
        setLiveLikes(next)
      },
      // A rules or network failure leaves the build-time counts showing rather
      // than emptying the page.
      () => {}
    )
    return () => unsub()
  }, [])

  const tags = useMemo(
    () => [...new Set(posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b)),
    [posts]
  )
  const shown = useMemo(
    () => (tag === 'all' ? posts : posts.filter((p) => p.tags.includes(tag))),
    [tag, posts]
  )

  const likesFor = (p: BlogPost) => liveLikes[p.slug] ?? p.likes
  const likedBy = (p: BlogPost) => likedSlugs.includes(p.slug)

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-white text-ink">
      <SiteHeader current="/blog" />

      {/* Masthead */}
      <section className="relative overflow-hidden border-b border-primary/10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-16 top-10 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        </div>

        <div className="relative mx-auto w-11/12 max-w-4xl py-14 text-center sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accentThree">Reading Guides</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight gradient-text sm:text-5xl">
            From our shelf to yours
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Gentle, practical guides on choosing books, building a reading habit that lasts, and
            making the most of Ramadan and Eid with your children.
          </p>
          <div className="mx-auto mt-7 h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </div>
      </section>

      <main className="mx-auto w-11/12 max-w-6xl py-10 sm:py-14">
        {tags.length > 0 && (
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setTag('all')}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 ${
                tag === 'all'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                  : 'border-2 border-primary/15 bg-white text-primaryDark hover:border-primary/35 hover:bg-primary/5'
              }`}
            >
              All articles
            </button>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 ${
                  tag === t
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'border-2 border-primary/15 bg-white text-primaryDark hover:border-primary/35 hover:bg-primary/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {shown.length ? (
          /* Every post gets the same card. A "featured" variant used to give the
             newest post a wide banner, but that put two different shapes on the
             page and left a lone narrow card stranded beside it whenever the
             post count was low. One shape reads as a deliberate grid at any
             count; the newest post still leads, because the list is sorted. */
          /* Capped and centred: with one or two posts a full-width 3-column
             grid stretches each card into a wide, ungainly shape. The cap keeps
             a card the same size whether there are two posts or twenty. */
          <div
            className={`grid items-stretch gap-6 sm:grid-cols-2 ${
              shown.length < 3 ? 'mx-auto max-w-3xl' : 'lg:grid-cols-3'
            }`}
          >
            {shown.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                likes={likesFor(post)}
                liked={likedBy(post)}
                // Only in the unfiltered view: inside a tag the first result is
                // not necessarily the newest article on the site.
                latest={tag === 'all' && index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border-2 border-dashed border-primary/20 bg-white/60 p-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primaryDark">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM14 4v6h6" />
              </svg>
            </span>
            <p className="mt-4 text-sm text-muted">
              {posts.length
                ? 'No articles with that tag yet.'
                : 'No articles published yet. Check back soon, in-sha-Allah.'}
            </p>
          </div>
        )}

        {/* Quiet cross-link, so the blog feeds the shop rather than dead-ending. */}
        <div className="mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-secondary p-8 text-center text-white shadow-xl sm:p-12">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Looking for the books themselves?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            Every title we write about is on our shelves, curated by age and ready to ship.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/shelves"
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primaryDark shadow-lg transition hover:-translate-y-0.5"
            >
              Browse the shelves
            </Link>
            <Link
              href="/catalog"
              className="rounded-full border-2 border-white/60 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              See the full catalog
            </Link>
          </div>
        </div>
      </main>

      <SiteFooterFull />
    </div>
  )
}
