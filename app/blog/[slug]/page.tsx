import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicCollection, SITE_URL } from '../../../lib/catalogBuild'
import { normalizeBlogPost, renderMarkdown, sortPosts, type BlogPost } from '../../../lib/blog'
import BlogPostClient from './PostClient'

export const dynamicParams = false

async function publishedPosts(): Promise<BlogPost[]> {
  const docs = await getPublicCollection('blog')
  return docs
    .map((d) => normalizeBlogPost(d, d.id))
    .filter((p) => p.published && p.title && p.slug)
    .sort(sortPosts)
}

export async function generateStaticParams() {
  const posts = await publishedPosts()
  // `output: export` rejects a dynamic route that generates no params at all,
  // failing the whole build. With no published posts that is exactly what
  // happens, so emit a placeholder slug: /blog is still correct and empty, and
  // deleting every post cannot take the site down.
  if (!posts.length) return [{ slug: 'no-posts-yet' }]
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = (await publishedPosts()).find((p) => p.slug === params.slug)
  if (!post) return { title: 'Article not found' }

  const url = `${SITE_URL}/blog/${post.slug}`
  const image = post.images[0]
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} | Eduvate Kids`,
      description: post.excerpt,
      url,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      authors: [post.author],
      ...(image ? { images: [{ url: image, alt: post.title }] } : {})
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${post.title} | Eduvate Kids`,
      description: post.excerpt,
      ...(image ? { images: [image] } : {})
    }
  }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const posts = await publishedPosts()
  const post = posts.find((p) => p.slug === params.slug)
  if (!post) notFound()

  const related = posts.filter((p) => p.id !== post.id).slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${SITE_URL}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.excerpt || undefined,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt || post.publishedAt || undefined,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@id': `${SITE_URL}/#organization` },
    ...(post.images.length ? { image: post.images } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(', ') } : {})
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostClient
        post={post}
        // Markdown is rendered on the server so the article text is in the
        // static HTML for crawlers, not assembled in the browser.
        bodyHtml={renderMarkdown(post.body)}
        related={related}
      />
    </>
  )
}
