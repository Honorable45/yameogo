import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/server-api';
import type { CatalogCard, Paginated } from '@/lib/types';
import { SITE_URL } from '@/lib/site';

const site = SITE_URL;
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await serverGet<Paginated<CatalogCard>>('/shop/catalog?pageSize=100', 3600);
  const pages = ['', '/telephones', '/accessoires', '/promotions', '/contact', '/avis', '/mentions-legales', '/confidentialite'];
  return [
    ...pages.map((p) => ({ url: `${site}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...(catalog?.items ?? []).map((p) => ({ url: `${site}/${p.kind === 'PHONE' ? 'telephones' : 'accessoires'}/${p.slug}`, changeFrequency: 'daily' as const, priority: 0.6 })),
  ];
}
