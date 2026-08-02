import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  SITE_URL,
  ageLabel,
  getCatalogProducts,
  getProductBySlug,
  isInStock,
  metaDescription,
  type CatalogProduct
} from '../../../lib/catalogBuild'
import ProductPageClient from './ProductPageClient'

/**
 * One statically generated page per catalog item.
 *
 * The storefront renders entirely client-side, which means crawlers and AI
 * assistants previously saw an empty document for every product. These pages
 * ship the title, description, price and availability as real HTML plus
 * Product/Offer JSON-LD, so the catalog is finally readable without JS.
 */

export const dynamicParams = false

export async function generateStaticParams() {
  const products = await getCatalogProducts()
  return products.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)
  if (!product) return { title: 'Book not found' }

  const url = `${SITE_URL}/book/${product.slug}`
  const image = product.images[0]
  const description = metaDescription(product)

  return {
    title: product.title,
    description,
    alternates: { canonical: `/book/${product.slug}` },
    openGraph: {
      title: `${product.title} | Eduvate Kids`,
      description,
      url,
      type: 'article',
      ...(image ? { images: [{ url: image, alt: `${product.title} cover` }] } : {})
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${product.title} | Eduvate Kids`,
      description,
      ...(image ? { images: [image] } : {})
    }
  }
}

/** Product + Offer + Breadcrumb structured data for one item. */
function productJsonLd(product: CatalogProduct) {
  const url = `${SITE_URL}/book/${product.slug}`
  // Derived from ageLabel so legacy range keys ("6-9") resolve the same way
  // they do in the visible copy, rather than via a naive parseInt.
  const minAge = Number(ageLabel(product).match(/\d+/)?.[0])

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: product.title,
        description: product.description || undefined,
        url,
        ...(product.images.length ? { image: product.images } : {}),
        ...(product.showPublisher && product.publisher
          ? { brand: { '@type': 'Brand', name: product.publisher } }
          : {}),
        ...(product.category.length ? { category: product.category.join(', ') } : {}),
        ...(Number.isFinite(minAge)
          ? { audience: { '@type': 'PeopleAudience', suggestedMinAge: minAge } }
          : {}),
        offers: {
          '@type': 'Offer',
          url,
          price: product.price.toFixed(2),
          priceCurrency: 'USD',
          availability: isInStock(product)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: { '@id': `${SITE_URL}/#organization` }
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Catalog', item: `${SITE_URL}/catalog` },
          { '@type': 'ListItem', position: 3, name: product.title, item: url }
        ]
      }
    ]
  }
}

export default async function BookPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        // Values come from our own Firestore catalog and are JSON-encoded.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)) }}
      />
      <ProductPageClient
        product={product}
        inStock={isInStock(product)}
        ageText={ageLabel(product)}
      />
    </>
  )
}
