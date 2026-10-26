import { ProductPage, productMetadata } from '@/components/site/product-page';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ configuration?: string }> };

export async function generateMetadata({ params }: Props) {
  return productMetadata((await params).slug, 'PHONE');
}

export default async function PhonePage({ params, searchParams }: Props) {
  return <ProductPage slug={(await params).slug} kind="PHONE" configuration={(await searchParams).configuration} />;
}
