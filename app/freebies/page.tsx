import type { Metadata } from 'next'
import { getPublicCollection, SITE_URL } from '../../lib/catalogBuild'
import { normalizeFreebie, sortFreebies, type Freebie } from '../../lib/freebies'
import FreebiesPageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Free Printables & Downloads',
  description:
    'Free Islamic printables for Muslim families: reading charts, activity sheets and classroom resources from Eduvate Kids. Subscribe to download.',
  alternates: { canonical: '/freebies' },
  openGraph: {
    title: 'Free Printables & Downloads | Eduvate Kids',
    description:
      'Free Islamic printables for Muslim families: reading charts, activity sheets and classroom resources.',
    url: '/freebies',
    type: 'website'
  }
}

export default async function Page() {
  const docs = await getPublicCollection('freebies')
  const freebies: Freebie[] = docs
    .map((d) => normalizeFreebie(d, d.id))
    .filter((f) => f.active && f.title)
    .sort(sortFreebies)

  // The card metadata is public, but fileUrl is deliberately stripped before
  // reaching the browser: the link is returned by getFreebieDownload after an
  // email is captured, so it is never sitting in the page source.
  const publicFreebies = freebies.map(({ fileUrl, ...rest }) => rest)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Free downloads from Eduvate Kids',
    url: `${SITE_URL}/freebies`,
    hasPart: publicFreebies.map((f) => ({
      '@type': 'CreativeWork',
      name: f.title,
      description: f.description || undefined,
      isAccessibleForFree: true,
      ...(f.coverImage ? { image: f.coverImage } : {})
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FreebiesPageClient freebies={publicFreebies} />
    </>
  )
}
