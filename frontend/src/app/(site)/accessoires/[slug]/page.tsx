import { ProductPage, productMetadata } from '@/components/site/product-page';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ configuration?: string }> };

export async function generateMetadata({ params }: Props) {
  return productMetadata((await params).slug, 'ACCESSORY');
}

export default async function AccessoryPage({ params, searchParams }: Props) {
  return <ProductPage slug={(await params).slug} kind="ACCESSORY" configuration={(await searchParams).configuration} />;
}
