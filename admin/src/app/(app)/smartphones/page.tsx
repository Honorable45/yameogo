'use client';

import { Suspense } from 'react';
import { CatalogList } from '@/components/admin/catalog-list';
import { LoadingBlock } from '@/components/ui/spinner';

export default function SmartphonesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CatalogList kind="PHONE" />
    </Suspense>
  );
}
