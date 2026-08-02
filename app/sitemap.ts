import type { MetadataRoute } from 'next'
import { getCatalogProducts, SITE_URL } from '../lib/catalogBuild'

/**
 * Sitemap generated at build time so every product page is listed. Replaces
 * the hand-maintained public/sitemap.xml, which could only ever list the
 * static routes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalogProducts()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/shelves`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/summer-reads`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/book-event`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/faqs`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact-us`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/policies`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/accessibility`, changeFrequency: 'yearly', priority: 0.3 }
  ]

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/book/${p.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7
  }))

  return [...staticRoutes, ...productRoutes]
}
