'use client';
import { useSiteUrl } from '@/lib/site-url';

import { Download, MessageSquareText, Printer } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { QrCode, qrPngDataUrl } from '@/components/admin/qr-code';
import { PageHeader, Pagination, Panel, Tabs } from '@/components/admin/ui';
import { Stars } from '@/components/admin/stars';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Field, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { REVIEW_STATUS } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface ReviewRow {
  id: string;
  rating: number;
  ratingWelcome: number | null;
  ratingValue: number | null;
  comment: string | null;
  displayName: string | null;
  serviceLabel: string;
  status: string;
  verified: boolean;
  shopReply: string | null;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  order: { id: string; number: string } | null;
  moderatedBy: { name: string } | null;
}

const params = (tab: string) => (tab === 'all' ? {} : tab === 'verified' ? { verified: 'true' } : { status: tab });

function QrPanel() {
  const siteUrl = useSiteUrl();
  const url = `${siteUrl}/avis/laisser`;
  const [printing, setPrinting] = useState(false);
  // Pas de QR code tant que l'adresse réelle du site n'est pas connue.
  if (!siteUrl) return <Panel title="QR code de la boutique"><LoadingBlock /></Panel>;
  return (
    <Panel title="QR code de la boutique">
      <div className="flex items-start gap-4">
        <QrCode value={url} size={112} />
        <div className="text-[13.5px]">
          <p className="text-ink-2">À afficher au comptoir : il ouvre la page d’avis, où le client saisit le code imprimé sur son ticket ou reçu sur WhatsApp. Sans code, pas d’avis.</p>
          <p className="mt-2 break-all font-mono text-[12px] text-muted">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPrinting(true)}>
              <Printer className="size-4" /> Affiche à imprimer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const a = document.createElement('a');
                a.href = await qrPngDataUrl(url);
                a.download = 'yameogo-qr-avis.png';
                a.click();
              }}
            >
              <Download className="size-4" /> PNG
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={printing} onClose={() => setPrinting(false)} title="Affiche « Votre avis »" footer={<Button onClick={() => window.print()}><Printer className="size-4" /> Imprimer</Button>}>
        <div className="print-area flex flex-col items-center bg-white px-6 py-10 text-center text-ink">
          <p className="font-serif text-[30px] font-semibold">YAMEOGO</p>
          <p className="display mt-6 text-[34px]">Votre avis compte</p>
          <p className="mt-2 text-[15px] text-ink-2">Scannez ce code avec l’appareil photo de votre téléphone.</p>
          <div className="mt-8">
            <QrCode value={url} size={260} />
          </div>
          <p className="mt-6 text-[13px] text-muted">Une minute, sans compte. Votre numéro n’est jamais publié.</p>
        </div>
      </Dialog>
    </Panel>
  );
}

function ReviewCard({ r, onChanged }: { r: ReviewRow; onChanged: () => void }) {
  const { notify } = useToast();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.shopReply ?? '');
  const moderate = async (status: string) => {
    try {
      await api.post(`/reviews/${r.id}/moderate`, { status });
      notify(`Avis : ${REVIEW_STATUS[status].label.toLowerCase()}.`);
      onChanged();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };
  const saveReply = async () => {
    try {
      await api.post(`/reviews/${r.id}/reply`, { reply: reply.trim() || null });
      notify('Réponse enregistrée.');
      setReplying(false);
      onChanged();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.rating} />
        {r.status !== 'PUBLISHED' && <Status tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Status>}
        {r.order && <Link href={`/commandes/${r.order.id}`} className="font-mono text-[12.5px] text-accent underline">{r.order.number}</Link>}
        {!r.order && <Tag>Sans code</Tag>}
        <span className="text-[12.5px] text-muted">
          {r.serviceLabel} · {formatDateTime(r.createdAt)}
          {r.displayName ? ` · ${r.displayName}` : ''}
        </span>
      </div>
      {r.comment ? <p className="mt-2 text-[14.5px] leading-relaxed">{r.comment}</p> : <p className="mt-2 text-[13.5px] italic text-muted">Sans commentaire</p>}
      <p className="mt-1.5 text-[12.5px] text-muted">
        {[r.ratingWelcome && `Accueil ${r.ratingWelcome}/5`, r.ratingValue && `Qualité-prix ${r.ratingValue}/5`].filter(Boolean).join(' · ')}
      </p>
      {r.shopReply && !replying && <p className="mt-2 border-l-2 border-line-2 pl-3 text-[13.5px] text-ink-2">Réponse : {r.shopReply}</p>}
      {replying && (
        <div className="mt-3">
          <Field label="Réponse publique de la boutique">{(p) => <Textarea {...p} rows={2} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={800} />}</Field>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={saveReply}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Annuler</Button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {r.status === 'PUBLISHED' ? (
          <Button size="sm" variant="secondary" onClick={() => moderate('HIDDEN')}>Masquer</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => moderate('PUBLISHED')}>{r.status === 'HIDDEN' ? 'Republier' : 'Publier'}</Button>
        )}
        {!replying && <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>{r.shopReply ? 'Modifier la réponse' : 'Répondre'}</Button>}
      </div>
      {r.moderatedBy && <p className="mt-2 text-[12px] text-faint">{r.status === 'HIDDEN' ? 'Masqué' : 'Modifié'} par {r.moderatedBy.name} le {formatDateTime(r.moderatedAt)}</p>}
    </li>
  );
}

function Reviews() {
  const list = useList<ReviewRow, { counts: Record<string, number> }>('/reviews', params, 'PUBLISHED');
  const counts = list.data?.counts ?? {};
  return (
    <>
      <PageHeader title="Avis clients" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs
            value={list.tab}
            onChange={list.setTab}
            items={[
              { value: 'PUBLISHED', label: 'Publiés', count: counts.PUBLISHED },
              { value: 'HIDDEN', label: 'Masqués', count: counts.HIDDEN },
              // Anciens avis déposés avant l'obligation du code (en attente de décision).
              ...(counts.PENDING ? [{ value: 'PENDING', label: 'Anciens à traiter', count: counts.PENDING }] : []),
              { value: 'all', label: 'Tous' },
            ]}
          />
          <div className="mt-4 rounded-md border border-line bg-surface">
            {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data ? <LoadingBlock /> : list.data.items.length === 0 ? (
              <EmptyState icon={MessageSquareText} title="Aucun avis dans cette vue" className="py-12" />
            ) : (
              <>
                <ul className="divide-y divide-line">{list.data.items.map((r) => <ReviewCard key={r.id} r={r} onChanged={list.reload} />)}</ul>
                <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
              </>
            )}
          </div>
        </div>
        <div className="lg:col-span-4">
          <QrPanel />
        </div>
      </div>
    </>
  );
}

export default function ReviewsAdminPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Reviews />
    </Suspense>
  );
}
