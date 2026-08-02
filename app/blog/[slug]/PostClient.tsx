'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, functions } from '../../../lib/firebase'
import type { BlogPost } from '../../../lib/blog'
import { readingMinutes } from '../../../lib/blog'
import { ImageSlider } from '../../components/ImageSlider'
import { SiteFooter, SiteHeader } from '../../components/SiteChrome'

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Remembers which posts this browser has liked, so the heart stays filled. */
const LIKED_KEY = 'eduvate-liked-posts'
const readLiked = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')
  } catch {
    return []
  }
}

function LikeButton({ post }: { post: BlogPost }) {
  // Seeded from the build, then replaced by the live count so a reader sees
  // other people's likes without waiting for a redeploy.
  const [likes, setLikes] = useState(post.likes)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => setLiked(readLiked().includes(post.slug)), [post.slug])

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'blog', post.id),
      (snap) => {
        const value = Number(snap.get('likes'))
        if (Number.isFinite(value)) setLikes(Math.max(0, value))
      },
      // A rules or network failure should leave the build-time count showing,
      // not break the article.
      () => {}
    )
    return () => unsub()
  }, [post.id])

  const handleLike = async () => {
    if (liked || busy) return
    setBusy(true)
    // Optimistic: the heart responds immediately, and the snapshot above
    // corrects the number a moment later.
    setLikes((n) => n + 1)
    setLiked(true)
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify([...new Set([...readLiked(), post.slug])]))
      const callable = httpsCallable<{ slug: string }, { likes: number }>(functions, 'likeBlogPost')
      const { data } = await callable({ slug: post.slug })
      if (Number.isFinite(data?.likes)) setLikes(Math.max(0, data.likes))
    } catch (error) {
      console.error('Like failed:', error)
      setLikes((n) => Math.max(0, n - 1))
      setLiked(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={liked || busy}
      aria-pressed={liked}
      aria-label={liked ? 'You liked this article' : 'Like this article'}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-bold transition-all ${
        liked
          ? 'border-pink-300 bg-pink-50 text-pink-700'
          : 'border-primary/20 bg-white text-primaryDark hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 hover:-translate-y-0.5'
      } disabled:cursor-default`}
    >
      <svg
        className={`h-5 w-5 transition-transform ${liked ? 'scale-110' : ''}`}
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.35-9.6-8.4A5.4 5.4 0 0112 5.6a5.4 5.4 0 019.6 7C19.5 16.65 12 21 12 21z" />
      </svg>
      <span>{likes}</span>
      <span className="hidden sm:inline">{liked ? 'Liked' : 'Like'}</span>
    </button>
  )
}

export default function BlogPostClient({
  post,
  bodyHtml,
  related
}: {
  post: BlogPost
  bodyHtml: string
  related: BlogPost[]
}) {
  return (
    <div className="min-h-screen text-ink">
      <SiteHeader current="/blog" />

      <main className="mx-auto w-11/12 max-w-3xl py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5 text-muted">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-primary">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-primaryDark" aria-current="page">{post.title}</li>
          </ol>
        </nav>

        <header>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-primaryDark">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-primaryDark">{post.author}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{readingMinutes(post.body)} min read</span>
          </div>
          {post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primaryDark">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {post.images.length > 0 && (
          <ImageSlider
            images={post.images}
            alt={post.title}
            className="mt-6 aspect-[16/9] w-full rounded-3xl shadow-xl"
          />
        )}

        {/* Server-rendered from Markdown; the source is escaped before any tag
            is emitted, so pasted content cannot inject HTML. */}
        <div
          className="mt-8 text-base text-ink/90"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-black/5 pt-6">
          <LikeButton post={post} />
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-bold text-primaryDark hover:text-primary transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All articles
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-bold text-primaryDark">Keep reading</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${r.slug}`}
                  className="rounded-2xl border border-primary/10 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <p className="font-display text-sm font-bold leading-snug text-primaryDark">{r.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{readingMinutes(r.body)} min read</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
