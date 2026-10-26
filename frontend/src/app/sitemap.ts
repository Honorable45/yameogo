import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/server-api';
import type { Paginated, PublicPhone, PublicProduct } from '@/lib/types';
import { SITE_URL } from '@/lib/site';

const site = SITE_URL;
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, phones] = await Promise.all([
    serverGet<Paginated<PublicProduct>>('/shop/products?pageSize=48', 3600),
    serverGet<PublicPhone[]>('/shop/phones', 3600),
  ]);
  const pages = ['', '/boutique', '/boutique?rayon=accessoires', '/reparation', '/avis', '/mentions-legales', '/confidentialite'];
  return [
    ...pages.map((p) => ({ url: `${site}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...(products?.items ?? []).map((p) => ({ url: `${site}/accessoires/${p.slug}`, changeFrequency: 'daily' as const, priority: 0.6 })),
    ...(phones ?? []).map((p) => ({ url: `${site}/telephones/${p.slug}`, changeFrequency: 'daily' as const, priority: 0.6 })),
  ];
}
