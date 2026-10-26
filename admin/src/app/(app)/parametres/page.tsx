'use client';

import { useState } from 'react';
import { HoursPanel } from '@/components/admin/settings/hours-panel';
import { BrandsPanel, CategoriesPanel, RepairTypesPanel } from '@/components/admin/settings/reference-panels';
import { CheckoutPanel, IdentityPanel, LegalPanel, SiteImagesPanel, type Settings } from '@/components/admin/settings/shop-settings';
import { PageHeader, Tabs } from '@/components/admin/ui';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import type { OpeningHour } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

interface SettingsResponse {
  settings: Settings;
  openingHours: OpeningHour[];
  paymentProviderConfigured: boolean;
}

export default function SettingsPage() {
  const [tab, setTab] = useState('shop');
  const { data, error, reload, setData } = useResource<SettingsResponse>('/settings');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock />;
  const onSaved = (settings: Settings) => setData({ ...data, settings });

  return (
    <>
      <PageHeader title="Paramètres" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'shop', label: 'Boutique' },
          { value: 'hours', label: 'Horaires' },
          { value: 'images', label: 'Photos du site' },
          { value: 'legal', label: 'Mentions légales' },
          { value: 'categories', label: 'Catégories' },
          { value: 'brands', label: 'Marques et modèles' },
          { value: 'types', label: 'Types de panne' },
        ]}
      />
      <div className="mt-6 max-w-5xl">
        {tab === 'shop' && <IdentityPanel key={String(data.settings.updatedAt)} settings={data.settings} onSaved={onSaved} />}
        {tab === 'hours' && <HoursPanel hours={data.openingHours} />}
        {tab === 'sales' && <CheckoutPanel key={String(data.settings.updatedAt)} settings={data.settings} providerConfigured={data.paymentProviderConfigured} onSaved={onSaved} />}
        {tab === 'images' && <SiteImagesPanel settings={data.settings} onSaved={onSaved} />}
        {tab === 'legal' && <LegalPanel key={String(data.settings.updatedAt)} settings={data.settings} onSaved={onSaved} />}
        {tab === 'categories' && <CategoriesPanel />}
        {tab === 'brands' && <BrandsPanel />}
        {tab === 'types' && <RepairTypesPanel />}
      </div>
    </>
  );
}
