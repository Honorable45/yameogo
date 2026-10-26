'use client';
import { useSiteUrl } from '@/lib/site-url';

import { Eye } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { ImageManager } from '@/components/admin/image-manager';
import { PhoneForm, type PhoneData } from '@/components/admin/phone-form';
import { useCan } from '@/components/admin/session';
import { DetailList, Metric, PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { BrandWithModels, SupplierRow } from '@/lib/admin-types';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { CONDITIONS, ORDER_STATUS, PHONE_STATUS } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface PhoneDetail extends PhoneData {
  reference: string;
  slug: string;
  title: string;
  gradeLabel: string;
  brand: { name: string };
  imeiLast4: string | null;
  estimatedMargin: number | null;
  soldAt: string | null;
  isDemo: boolean;
  images: { id: string; url: string | null; alt: string; position: number }[];
  events: { id: string; type: string; message: string; createdAt: string; user: { name: string } | null }[];
  sales: { id: string; unitPrice: number; unitCost: number | null; returnedQuantity: number; grossMargin: number | null; order: { id: string; number: string; status: string; completedAt: string | null; createdAt: string } }[];
}

const MANUAL: Record<string, { to: string; label: string }[]> = {
  PENDING_CHECK: [
    { to: 'AVAILABLE', label: 'Contrôlé : mettre en vente' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  AVAILABLE: [
    { to: 'PENDING_CHECK', label: 'Retirer de la vente' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  RETURNED: [
    { to: 'PENDING_CHECK', label: 'À revérifier' },
    { to: 'AVAILABLE', label: 'Remettre en vente' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  ARCHIVED: [{ to: 'PENDING_CHECK', label: 'Désarchiver' }],
};

export default function PhonePage({ params }: { params: Promise<{ id: string }> }) {
  const siteUrl = useSiteUrl();
  const { id } = use(params);
  const can = useCan();
  const { notify } = useToast();
  const { data: p, error, reload } = useResource<PhoneDetail>(`/used-phones/${id}`);
  const brands = useResource<BrandWithModels[]>(can('usedPhones.write') ? '/brands' : null);
  const suppliers = useResource<SupplierRow[]>(can('suppliers.manage') ? '/suppliers' : null);
  const [imei, setImei] = useState<string | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!p) return <LoadingBlock />;
  const st = PHONE_STATUS[p.status];
  const editable = can('usedPhones.write');

  const changeStatus = async (to: string) => {
    try {
      await api.post(`/used-phones/${p.id}/status`, { status: to });
      notify('Statut mis à jour.');
      reload();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };
  const revealImei = async () => {
    try {
      setImei((await api.post<{ imei: string | null }>(`/used-phones/${p.id}/imei`)).imei ?? 'Non renseigné');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };
  const sale = p.sales.find((s) => s.order.status === 'COMPLETED' && s.returnedQuantity === 0);

  return (
    <>
      <PageHeader
        back={{ href: '/occasions', label: 'Téléphones' }}
        title={`${p.brand.name} ${p.title}`}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{p.reference}</span>
            <Status tone={st.tone}>{st.label}</Status>
            <Tag tone={p.condition === 'NEW' ? 'ok' : p.condition === 'IMPORTED' ? 'warn' : 'info'}>{CONDITIONS[p.condition]}</Tag>
            {p.isDemo && <Tag tone="warn">Démo</Tag>}
            {(p.status === 'AVAILABLE' || p.status === 'RESERVED') && (
              <Link href={`${siteUrl}/telephones/${p.slug}`} target="_blank" className="text-accent underline">
                Voir sur le site
              </Link>
            )}
          </span>
        }
      >
        {editable && MANUAL[p.status] && (
          <div className="flex flex-wrap gap-2">
            {MANUAL[p.status].map((a, i) => (
              <Button key={a.to} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => changeStatus(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </PageHeader>

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        <div className="bg-surface px-5 py-4">
          <Metric label="Prix de vente" value={formatPrice(p.salePrice)} />
        </div>
        {p.purchasePrice !== null && (
          <div className="bg-surface px-5 py-4">
            <Metric label="Prix d’achat" value={formatPrice(p.purchasePrice)} note={`Acquis le ${formatDate(p.acquiredAt)}`} />
          </div>
        )}
        {p.estimatedMargin !== null && (
          <div className="bg-surface px-5 py-4">
            <Metric label={sale ? 'Marge brute réalisée' : 'Marge brute estimée'} value={formatPrice(sale?.grossMargin ?? p.estimatedMargin)} tone={(sale?.grossMargin ?? p.estimatedMargin) < 0 ? 'bad' : undefined} note={sale ? `Vendu ${formatPrice(sale.unitPrice)}` : 'Prix de vente − prix d’achat'} />
          </div>
        )}
        <div className="bg-surface px-5 py-4">
          <p className="text-[12.5px] text-muted">IMEI</p>
          <p className="mt-2 font-mono text-[15px]">{imei ?? (p.hasImei ? `•••• ${p.imeiLast4}` : 'Non renseigné')}</p>
          {p.hasImei && !imei && can('usedPhones.imei') && (
            <button type="button" onClick={revealImei} className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-accent underline">
              <Eye className="size-3.5" /> Afficher (consultation journalisée)
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel title="Photos réelles de l’appareil">
            {editable ? (
              <ImageManager images={p.images} endpoint={`/used-phones/${p.id}`} max={10} onChange={reload} hint="Photographiez l’appareil vendu (face, dos, tranches, défauts). Au moins une photo est exigée pour la mise en vente." />
            ) : (
              <p className="text-[13.5px] text-muted">{p.images.length} photo(s).</p>
            )}
          </Panel>
          {editable && brands.data ? (
            <PhoneForm key={p.updatedAt} phone={p} brands={brands.data} suppliers={suppliers.data ?? []} />
          ) : (
            <Panel title="Fiche">
              <DetailList
                items={[
                  ['État', p.gradeLabel],
                  ['Batterie', p.batteryHealth !== null ? `${p.batteryHealth} %` : null],
                  ['Défauts connus', p.knownDefects],
                  ['Accessoires', p.includedAccessories],
                  ['Garantie', p.warrantyMonths ? `${p.warrantyMonths} mois` : 'Aucune'],
                ]}
              />
            </Panel>
          )}
        </div>
        <div className="space-y-6 lg:col-span-5">
          {p.sales.length > 0 && (
            <Panel title="Ventes">
              <ul className="space-y-2 text-[13.5px]">
                {p.sales.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span>
                      <Link href={`/commandes/${s.order.id}`} className="font-mono text-accent hover:underline">
                        {s.order.number}
                      </Link>{' '}
                      · {ORDER_STATUS[s.order.status].label}
                      {s.returnedQuantity > 0 && <span className="text-bad"> · retourné</span>}
                    </span>
                    <span className="num">{formatPrice(s.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Historique de l’appareil">
            <ol className="space-y-3 text-[13.5px]">
              {p.events.map((e) => (
                <li key={e.id}>
                  <p>{e.message}</p>
                  <p className="text-[12px] text-muted">
                    {formatDateTime(e.createdAt)}
                    {e.user ? ` · ${e.user.name}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
