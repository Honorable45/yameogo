'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import type { AdminProduct } from '@/lib/admin-types';
import { useResource } from '@/lib/use-resource';

/** Lien vers un article (configuration) : ouvre la fiche produit à laquelle il appartient. */
export default function ProductRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error } = useResource<AdminProduct>(`/products/${id}`);
  useEffect(() => {
    if (data) router.replace(`/catalogue/${data.group.id}`);
  }, [data, router]);
  return error ? <ErrorState message={error} /> : <LoadingBlock />;
}
