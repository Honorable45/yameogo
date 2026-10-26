'use client';

import { PhoneForm } from '@/components/admin/phone-form';
import { useCan } from '@/components/admin/session';
import { PageHeader } from '@/components/admin/ui';
import { LoadingBlock } from '@/components/ui/spinner';
import type { BrandWithModels, SupplierRow } from '@/lib/admin-types';
import { useResource } from '@/lib/use-resource';

export default function NewPhonePage() {
  const can = useCan();
  const brands = useResource<BrandWithModels[]>('/brands');
  const suppliers = useResource<SupplierRow[]>(can('suppliers.manage') ? '/suppliers' : null);
  if (!brands.data) return <LoadingBlock />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Enregistrer un téléphone" back={{ href: '/occasions', label: 'Téléphones' }} />
      <PhoneForm brands={brands.data} suppliers={suppliers.data ?? []} />
    </div>
  );
}
