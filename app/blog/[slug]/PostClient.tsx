'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, functions } from '../../../lib/firebase'
import type { BlogPost } from '../../../lib/blog'
import { readingMinutes } from '../../../lib/blog'
import { forgetLiked, hasLiked, rememberLiked } from '../../../lib/likes'
import { trackBlogLike } from '../../../lib/analytics'
import { ImageSlider } from '../../components/ImageSlider'
import { SiteHeader } from '../../components/SiteChrome'
import { SiteFooterFull } from '../../components/SiteFooterFull'

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function LikeButton({ post }: { post: BlogPost }) {
  // Seeded from the build, then replaced by the live count so a reader sees
  // other people's likes without waiting for a redeploy.
  const [likes, setLikes] = useState(post.likes)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  // Read after mount, never during render: the server has no localStorage, so
  // seeding from it directly would mismatch the hydrated markup.
  useEffect(() => setLiked(hasLiked(post.slug)), [post.slug])

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
    rememberLiked(post.slug)
    trackBlogLike(post.slug, post.title)
    try {
      const callable = httpsCallable<{ slug: string }, { likes: number }>(functions, 'likeBlogPost')
      const { data } = await callable({ slug: post.slug })
      if (Number.isFinite(data?.likes)) setLikes(Math.max(0, data.likes))
    } catch (error) {
      // Roll the whole thing back, including the stored flag, so a failed like
      // can be retried rather than leaving the heart permanently filled.
      console.error('Like failed:', error)
      forgetLiked(post.slug)
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
      aria-label={liked ? 'You have already liked this article' : 'Like this article'}
      title={liked ? 'You have already liked this article' : 'Like this article'}
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

/** Thin bar showing how far through the article the reader is. */
function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
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
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-white text-ink">
      <ReadingProgress />
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

        <header className="text-center">
          {post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap justify-center gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primaryDark"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-display text-3xl font-bold leading-tight text-primaryDark sm:text-[2.75rem] sm:leading-[1.15]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">{post.excerpt}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <span className="font-semibold text-primaryDark">{post.author}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{readingMinutes(post.body)} min read</span>
          </div>
          {/* Up here as well as at the foot: a reader who already knows the
              piece should not have to scroll to the end to say so. Both render
              the same component, so the count and filled state stay in step. */}
          <div className="mt-5 flex justify-center">
            <LikeButton post={post} />
          </div>
          <div className="mx-auto mt-7 h-px w-20 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </header>

        {post.images.length > 0 && (
          <ImageSlider
            images={post.images}
            alt={post.title}
            className="mt-8 aspect-[16/9] w-full rounded-[1.75rem] shadow-[0_20px_50px_-20px_rgba(124,58,237,0.45)]"
          />
        )}

        {/* Server-rendered from Markdown; the source is escaped before any tag
            is emitted, so pasted content cannot inject HTML. `article-body`
            carries the reading typography (see globals.css). */}
        <div
          className="article-body mt-10"
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
          <section className="mt-16">
            <h2 className="text-center font-display text-xl font-bold text-primaryDark">Keep reading</h2>
            <div className="mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${r.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg"
                >
                  {r.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.images[0]} alt="" className="h-24 w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="h-24 w-full bg-gradient-to-br from-primary/10 via-cream to-secondary/10" />
                  )}
                  <span className="flex flex-1 flex-col p-4">
                    <span className="font-display text-sm font-bold leading-snug text-primaryDark transition-colors group-hover:text-primary">
                      {r.title}
                    </span>
                    <span className="mt-1 text-[11px] text-muted">{readingMinutes(r.body)} min read</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Feed the shop rather than dead-ending the reader. */}
        <div className="mt-14 rounded-[1.75rem] bg-gradient-to-br from-primary to-secondary p-8 text-center text-white shadow-xl">
          <h2 className="font-display text-xl font-bold sm:text-2xl">Find the books we write about</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
            Curated by age, ready to ship from Maryland.
          </p>
          <Link
            href="/shelves"
            className="mt-5 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-primaryDark shadow-lg transition hover:-translate-y-0.5"
          >
            Browse the shelves
          </Link>
        </div>
      </main>

      <SiteFooterFull />
    </div>
  )
}
