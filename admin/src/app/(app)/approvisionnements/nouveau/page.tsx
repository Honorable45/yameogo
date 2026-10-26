'use client';

import { PurchaseForm } from '@/components/admin/purchase-form';
import { PageHeader } from '@/components/admin/ui';
import { LoadingBlock } from '@/components/ui/spinner';
import type { SupplierRow } from '@/lib/admin-types';
import { useResource } from '@/lib/use-resource';

export default function NewPurchasePage() {
  const suppliers = useResource<SupplierRow[]>('/suppliers');
  if (!suppliers.data) return <LoadingBlock />;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nouvel approvisionnement" back={{ href: '/approvisionnements', label: 'Approvisionnements' }} />
      <PurchaseForm suppliers={suppliers.data} />
    </div>
  );
}
