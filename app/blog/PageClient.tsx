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

function PostCard({
  post,
  likes,
  liked
}: {
  post: BlogPost
  likes: number
  liked: boolean
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/10 to-secondary/10">
          {post.images.length ? (
            <ImageSlider images={post.images} alt={post.title} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <svg className="h-12 w-12 text-primary/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM14 4v6h6" />
              </svg>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted">
            <span>{formatDate(post.publishedAt)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{readingMinutes(post.body)} min read</span>
            {(likes > 0 || liked) && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span
                  className={`inline-flex items-center gap-1 ${liked ? 'text-pink-600' : 'text-muted'}`}
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
              </>
            )}
          </div>

          <h2 className="mt-2 font-display text-lg font-bold leading-snug text-primaryDark group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{post.excerpt}</p>}

          {post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primaryDark">
                  {tag}
                </span>
              ))}
            </div>
          )}
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

  return (
    <div className="min-h-screen text-ink">
      <SiteHeader current="/blog" />

      <main className="mx-auto w-11/12 max-w-6xl py-10 sm:py-14">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Reading Guides</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl gradient-text">From our shelf to yours</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted">
            Practical guides on choosing books, building reading habits, and making the most of
            Ramadan and Eid with children.
          </p>
        </div>

        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setTag('all')}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                tag === 'all'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                  : 'border-2 border-primary/20 bg-white text-primaryDark hover:bg-primary/5'
              }`}
            >
              All articles
            </button>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  tag === t
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'border-2 border-primary/20 bg-white text-primaryDark hover:bg-primary/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {shown.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                likes={liveLikes[post.slug] ?? post.likes}
                liked={likedSlugs.includes(post.slug)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center text-sm text-muted">
            {posts.length
              ? 'No articles with that tag yet.'
              : 'No articles published yet. Check back soon.'}
          </p>
        )}
      </main>

      <SiteFooterFull />
    </div>
  )
}
