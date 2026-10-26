'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useCan } from '@/components/admin/session';
import { DetailList, PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { StaffMember } from '@/lib/admin-types';
import { formatDateTime, formatDuration, formatPhone, formatPrice, whatsappLink } from '@/lib/format';
import { REQUEST_STATUS, ROLES } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface RequestDetail {
  id: string;
  reference: string;
  brandName: string;
  modelName: string;
  issueLabel: string;
  estimatedParts: number | null;
  estimatedLabor: number | null;
  estimatedTotal: number | null;
  estimatedMinutes: number | null;
  customerName: string | null;
  customerPhone: string;
  description: string | null;
  photoUrl: string | null;
  status: string;
  internalNote: string | null;
  createdAt: string;
  repairJob: { id: string; number: string; status: string } | null;
  knownCustomer: { id: string; name: string } | null;
}

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const can = useCan();
  const { notify } = useToast();
  const { data: r, error, reload, setData } = useResource<RequestDetail>(`/repair-requests/${id}`);
  const staff = useResource<StaffMember[]>('/users/staff');
  const [note, setNote] = useState<string | null>(null);
  const [technicianId, setTechnicianId] = useState('');
  const [imei, setImei] = useState('');
  const [converting, setConverting] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!r) return <LoadingBlock />;

  const patch = async (body: Record<string, unknown>) => {
    try {
      const updated = await api.patch<RequestDetail>(`/repair-requests/${id}`, body);
      setData({ ...r, ...updated });
      notify('Demande mise à jour.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  const convert = async () => {
    setConverting(true);
    try {
      const job = await api.post<{ id: string; number: string }>(`/repair-requests/${id}/convert`, { technicianId: technicianId || undefined, imei: imei.trim() || undefined });
      notify(`Dossier ${job.number} créé.`);
      router.push(`/reparations/${job.id}`);
    } catch (err) {
      notify(errorMessage(err), 'bad');
      setConverting(false);
    }
  };

  const wa = whatsappLink(r.customerPhone, `Bonjour${r.customerName ? ` ${r.customerName}` : ''}, YAMEOGO au sujet de votre demande ${r.reference} (${r.brandName} ${r.modelName}).`);
  const st = REQUEST_STATUS[r.status];

  return (
    <>
      <PageHeader
        back={{ href: '/demandes', label: 'Demandes de devis' }}
        title={
          <span>
            {r.brandName} {r.modelName} <span className="font-mono text-[18px] font-normal text-muted">{r.reference}</span>
          </span>
        }
        description={<Status tone={st.tone}>{st.label}</Status>}
        actions={
          <>
            <a href={`tel:${r.customerPhone}`} className="inline-flex h-10 items-center rounded-sm border border-line-2 bg-surface px-4 text-[14px] font-medium">
              Appeler
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-sm border border-line-2 bg-surface px-4 text-[14px] font-medium">
                WhatsApp
              </a>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel title="Demande">
            <DetailList
              items={[
                ['Client', <span key="c">{r.customerName ?? 'Non indiqué'}{r.knownCustomer && <Link href={`/clients/${r.knownCustomer.id}`} className="ml-2 text-[12.5px] text-accent underline">client connu</Link>}</span>],
                ['Téléphone', <span key="t" className="num">{formatPhone(r.customerPhone)}</span>],
                ['Panne', r.issueLabel],
                ['Description', r.description && <span className="whitespace-pre-line">{r.description}</span>],
                ['Reçue le', formatDateTime(r.createdAt)],
              ]}
            />
            {r.photoUrl && (
              <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="Photo envoyée par le client" className="max-h-72 rounded-sm border border-line object-contain" />
              </a>
            )}
          </Panel>
          <Panel title="Estimation affichée au client">
            {r.estimatedTotal !== null ? (
              <DetailList
                items={[
                  ['Pièces', formatPrice(r.estimatedParts)],
                  ['Main-d’œuvre', formatPrice(r.estimatedLabor)],
                  ['Total estimé', <strong key="t" className="num">{formatPrice(r.estimatedTotal)}</strong>],
                  ['Durée', formatDuration(r.estimatedMinutes)],
                ]}
              />
            ) : (
              <p className="text-[14px] text-muted">Aucun tarif n’était configuré : le client attend une estimation personnalisée.</p>
            )}
          </Panel>
          <Panel title="Suivi interne">
            <Field label="Note interne">{(p) => <Textarea {...p} rows={3} value={note ?? r.internalNote ?? ''} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Client rappelé, dépôt prévu jeudi…" />}</Field>
            <div className="mt-3 flex flex-wrap gap-2">
              {note !== null && note !== (r.internalNote ?? '') && (
                <Button size="sm" onClick={() => patch({ internalNote: note })}>
                  Enregistrer la note
                </Button>
              )}
              {r.status === 'NEW' && (
                <Button size="sm" variant="secondary" onClick={() => patch({ status: 'CONTACTED' })}>
                  Marquer « client contacté »
                </Button>
              )}
              {(r.status === 'NEW' || r.status === 'CONTACTED') && (
                <Button size="sm" variant="ghost" onClick={() => patch({ status: 'CLOSED' })}>
                  Classer sans suite
                </Button>
              )}
              {r.status === 'CLOSED' && (
                <Button size="sm" variant="ghost" onClick={() => patch({ status: 'CONTACTED' })}>
                  Rouvrir
                </Button>
              )}
            </div>
          </Panel>
        </div>
        <div className="lg:col-span-5">
          <Panel title="Prise en charge">
            {r.repairJob ? (
              <p className="text-[14px]">
                Dossier{' '}
                <Link href={`/reparations/${r.repairJob.id}`} className="font-mono text-accent underline">
                  {r.repairJob.number}
                </Link>{' '}
                créé à partir de cette demande.
              </p>
            ) : can('repairs.write') ? (
              <div className="space-y-4">
                <p className="text-[13.5px] text-muted">Quand le client dépose son téléphone, créez le dossier : les informations de la demande sont reprises.</p>
                <Field label="Réparateur" optional>
                  {(p) => (
                    <Select {...p} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                      <option value="">Non attribué</option>
                      {staff.data?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {ROLES[u.role]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="IMEI" optional>{(p) => <Input {...p} value={imei} onChange={(e) => setImei(e.target.value)} className="font-mono" maxLength={30} />}</Field>
                <Button onClick={convert} loading={converting} className="w-full">
                  Prendre en charge le téléphone
                </Button>
              </div>
            ) : (
              <p className="text-[13.5px] text-muted">La prise en charge est réservée à l’atelier.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
