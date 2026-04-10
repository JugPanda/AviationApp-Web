import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/tools', '/plan', '/logbook'],
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}