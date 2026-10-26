import type { MetadataRoute } from 'next';

/** Application interne : jamais indexée. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
