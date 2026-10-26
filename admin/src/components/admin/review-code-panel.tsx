'use client';

import { Copy, Printer, RefreshCw, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingBlock } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatDate, whatsappLink } from '@/lib/format';
import { useSiteUrl } from '@/lib/site-url';
import { useResource } from '@/lib/use-resource';
import { QrCode } from './qr-code';
import { useCan } from './session';
import { Panel } from './ui';

interface ReviewCode {
  code: string | null;
  expiresAt: string | null;
  usable: boolean;
  waitingFor: string | null;
  review: { id: string; rating: number; createdAt: string; status: string } | null;
}

/** « ABCD2345 » → « ABCD-2345 » : plus facile à lire et à dicter. */
const display = (code: string) => code.replace(/(.{4})(?=.)/g, '$1-');

/**
 * Code d'avis d'une réparation ou d'une vente : créé automatiquement, toujours visible ici,
 * à remettre au client (WhatsApp, impression ou QR code). Sans ce code, le client ne peut pas donner d'avis.
 */
export function ReviewCodePanel({ kind, id, customerPhone }: { kind: 'reparation' | 'vente'; id: string; customerPhone?: string | null }) {
  const can = useCan();
  const siteUrl = useSiteUrl();
  const { notify } = useToast();
  const { data, error, setData } = useResource<ReviewCode>(can('reviews.tokens') ? `/review-codes/${kind}/${id}` : null);
  const [busy, setBusy] = useState(false);
  if (!can('reviews.tokens')) return null;

  const link = data?.code && siteUrl ? `${siteUrl}/avis/laisser?code=${data.code}` : null;
  const message = data?.code ? `Merci pour votre confiance ! Donnez votre avis sur YAMEOGO avec ce code : ${display(data.code)}${link ? `\n${link}` : ''}` : '';
  const whatsapp = data?.code ? whatsappLink(customerPhone, message) : null;

  const regenerate = async () => {
    setBusy(true);
    try {
      setData(await api.post<ReviewCode>(`/review-codes/${kind}/${id}/regenerate`));
      notify('Nouveau code créé : l’ancien ne fonctionne plus.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Code d’avis client">
      {error ? (
        <p className="text-[13.5px] text-muted">{error}</p>
      ) : !data ? (
        <LoadingBlock />
      ) : data.review ? (
        <p className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
          <Star className="size-4 fill-ochre text-ochre" />
          Avis reçu le {formatDate(data.review.createdAt)} : {data.review.rating}/5.
          <Link href="/avis" className="text-accent underline">
            Voir les avis
          </Link>
        </p>
      ) : (
        <div className="print-area">
          <div className="flex items-start gap-4">
            {link && <QrCode value={link} size={96} />}
            <div className="min-w-0">
              <p className="font-mono text-[24px] font-semibold tracking-[0.12em]">{display(data.code!)}</p>
              <p className="mt-1 text-[12.5px] text-muted">{data.usable ? 'Le client peut donner son avis dès maintenant.' : `Utilisable après ${data.waitingFor}.`}</p>
              {data.expiresAt && <p className="text-[12px] text-faint">Valable jusqu’au {formatDate(data.expiresAt)} · une seule utilisation</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-[#1f9d55] px-3 text-[13px] font-medium text-white hover:bg-[#188247]">
                Envoyer au client
              </a>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(message);
                notify('Message copié.');
              }}
            >
              <Copy className="size-4" /> Copier
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer
            </Button>
            <Button size="sm" variant="ghost" onClick={regenerate} loading={busy}>
              <RefreshCw className="size-4" /> Nouveau code
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
