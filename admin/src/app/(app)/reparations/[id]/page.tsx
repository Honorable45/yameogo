'use client';

import Link from 'next/link';
import { use, useEffect, useState, type ReactNode } from 'react';
import { PaymentsPanel } from '@/components/admin/payments-panel';
import { CostsPanel, PartsPanel } from '@/components/admin/repair/parts-costs';
import { ImeiValue, TrackingPanel, WorkPanel } from '@/components/admin/repair/extras';
import { ReviewCodePanel } from '@/components/admin/review-code-panel';
import { HistoryPanel, QuotesPanel, StatusActions } from '@/components/admin/repair/workflow';
import { useCan } from '@/components/admin/session';
import { DetailList, PageHeader, Panel } from '@/components/admin/ui';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { api } from '@/lib/api';
import type { RepairDetail, StaffMember } from '@/lib/admin-types';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { REPAIR_STATUS, SETTLEMENT } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

export default function RepairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const { data: repair, error, reload, setData } = useResource<RepairDetail>(`/repairs/${id}`);
  const staff = useResource<StaffMember[]>('/users/staff');
  const [suggested, setSuggested] = useState<number | null>(null);

  useEffect(() => {
    if (!repair?.phoneModelId || !repair.repairTypeId) return setSuggested(null);
    api
      .get<{ estimate: { totalPrice: number } | null }>(`/repair-catalog/estimate?modelId=${repair.phoneModelId}&typeId=${repair.repairTypeId}`)
      .then((r) => setSuggested(r.estimate?.totalPrice ?? null))
      .catch(() => setSuggested(null));
  }, [repair?.phoneModelId, repair?.repairTypeId]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!repair) return <LoadingBlock />;
  const update = (r: RepairDetail) => setData(r);
  const st = REPAIR_STATUS[repair.status];
  const pay = SETTLEMENT[repair.paymentStatus];
  const device = repair.deviceReturnedAt ? { tone: 'done' as const, label: `Rendu le ${formatDate(repair.deviceReturnedAt)}` } : { tone: 'warn' as const, label: 'En boutique' };

  return (
    <>
      <PageHeader
        back={{ href: '/reparations', label: 'Réparations' }}
        title={
          <span>
            {repair.brandName} {repair.modelName} <span className="font-mono text-[18px] font-normal text-muted">{repair.number}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <span className="text-faint">Dossier</span> <Status tone={st.tone}>{st.label}</Status>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-faint">Paiement</span> {repair.billedAmount ? <Status tone={pay.tone}>{pay.label}</Status> : <span className="text-ink-2">À définir</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-faint">Téléphone</span> <Status tone={device.tone}>{device.label}</Status>
            </span>
          </span>
        }
      >
        <StatusActions repair={repair} onUpdate={update} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel title="Client et appareil">
            <DetailList
              items={[
                [
                  'Client',
                  <span key="c">
                    <Link href={`/clients/${repair.customer.id}`} className="font-medium hover:underline">
                      {repair.customer.name}
                    </Link>{' '}
                    ·{' '}
                    <a href={`tel:${repair.customer.phone}`} className="num text-ink-2 hover:underline">
                      {formatPhone(repair.customer.phone)}
                    </a>
                  </span>,
                ],
                ['Appareil', `${repair.brandName} ${repair.modelName}`],
                ['IMEI', <ImeiValue key="i" repair={repair} />],
                ['Panne signalée', <span key="p" className="whitespace-pre-line">{repair.reportedIssue}</span>],
                ['Type de panne', repair.repairType?.name],
                ['Reçu le', `${formatDateTime(repair.receivedAt)} par ${repair.createdBy.name}`],
                ...(repair.completedAt ? [['Terminé le', formatDateTime(repair.completedAt)] as [string, string]] : []),
                ...(repair.request ? [['Demande en ligne', <Link key="r" href={`/demandes/${repair.request.id}`} className="font-mono text-accent hover:underline">{repair.request.reference}</Link>] as [string, ReactNode]] : []),
              ]}
            />
          </Panel>
          <WorkPanel repair={repair} onUpdate={update} staff={staff.data ?? []} />
          <QuotesPanel repair={repair} onUpdate={update} suggested={suggested} />
          <PartsPanel repair={repair} onUpdate={update} />
          <HistoryPanel repair={repair} />
        </div>

        <div className="space-y-6 lg:col-span-5">
          <CostsPanel repair={repair} onUpdate={update} />
          <PaymentsPanel
            payments={repair.payments}
            due={repair.billedAmount}
            paid={repair.amountPaid}
            endpoint={`/repairs/${repair.id}/payments`}
            canRecord={can('repairs.payments')}
            allowRefund={can('payments.cancel')}
            onChange={(r) => (r ? update(r as RepairDetail) : void reload())}
            disabledReason={repair.status === 'CANCELLED' ? 'Dossier annulé : aucun encaissement possible.' : !repair.billedAmount ? 'Fixez d’abord le montant facturé (devis accepté ou montant convenu).' : null}
          />
          <TrackingPanel repair={repair} />
          {repair.status !== 'CANCELLED' && <ReviewCodePanel kind="reparation" id={repair.id} customerPhone={repair.customer.phone} />}
        </div>
      </div>
    </>
  );
}
