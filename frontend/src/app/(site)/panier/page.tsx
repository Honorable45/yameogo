import type { Metadata } from 'next';
import { BackButton } from '@/components/site/back-button';
import { CartView } from '@/components/site/cart-view';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';

export const metadata: Metadata = { title: 'Panier', robots: { index: false } };

export default async function CartPage() {
  const settings = await serverGet<PublicSettings>('/settings/public', 60);
  return (
    <div className="container-page pt-40 lg:pt-32">
      <BackButton fallback="/telephones" className="mb-6" />
      <h1 className="display mb-8 text-[38px] sm:text-[48px]">Panier</h1>
      <CartView whatsapp={settings?.whatsapp ?? null} shopName={settings?.shopName ?? 'Le Marchand'} deliveryInfo={settings?.deliveryInfo ?? null} />
    </div>
  );
}
