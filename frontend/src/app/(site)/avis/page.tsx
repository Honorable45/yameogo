import { BadgeCheck, PenLine } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Stars } from '@/components/site/catalog';
import { PageHero } from '@/components/site/page-hero';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings, ReviewsPage } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Avis clients',
  description: 'Les avis des clients de YAMEOGO, donnés avec le code reçu lors de leur achat.',
  alternates: { canonical: '/avis' },
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [data, settings] = await Promise.all([serverGet<ReviewsPage>(`/reviews/public?page=${page}&pageSize=12`, 120), serverGet<PublicSettings>('/settings/public', 60)]);
  const s = data?.summary;
  const has = Boolean(s && s.count > 0 && s.average !== null);
  const details: [string, number | null | undefined][] = [
    ['Accueil', s?.averageWelcome],
    ['Qualité-prix', s?.averageValue],
  ];

  return (
    <>
      <PageHero title="Avis clients" image={settings?.shopImageUrl}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          {has && s && (
            <div className="glass flex items-center gap-5 rounded-3xl px-6 py-4">
              <span className="display num text-[52px] leading-none">{s.average!.toLocaleString('fr-FR')}</span>
              <span>
                <Stars value={s.average!} size="md" />
                <span className="mt-1 block text-[13.5px] text-white/75">
                  {s.count} avis · {s.verifiedCount} vérifiés
                </span>
              </span>
            </div>
          )}
          <Link href="/avis/laisser" className="glass inline-flex h-14 items-center justify-center gap-2 self-start rounded-full px-7 text-[15.5px] font-medium text-white transition-colors hover:bg-white/25 sm:self-center">
            <PenLine className="size-4" /> Laisser un avis
          </Link>
        </div>
      </PageHero>

      <div className="container-page mt-10">
        {has && (
          <ul className="mb-8 flex flex-wrap gap-2">
            {details
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <li key={label} className="glass-light rounded-full px-4 py-2 text-[13.5px]">
                  {label} <span className="num ml-1 font-semibold text-navy">{(v as number).toLocaleString('fr-FR')}</span>
                </li>
              ))}
          </ul>
        )}

        {!has || !data ? (
          <div className="glass-light mx-auto max-w-lg rounded-3xl p-10 text-center">
            <p className="display text-[26px]">Aucun avis pour le moment</p>
            <p className="mt-2 text-[15px] text-muted">Vous êtes client ? Votre avis aide les autres.</p>
            <Link href="/avis/laisser" className="glass-dark mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-white">
              <PenLine className="size-4" /> Donner mon avis
            </Link>
          </div>
        ) : (
          <>
            <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
              {data.items.map((r) => (
                <li key={r.id} className="break-inside-avoid rounded-3xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between gap-3">
                    <Stars value={r.rating} />
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-medium text-ok">
                        <BadgeCheck className="size-3.5" /> Vérifié
                      </span>
                    )}
                  </div>
                  {r.comment && <p className="mt-4 text-[15.5px] leading-relaxed">« {r.comment} »</p>}
                  <p className="mt-4 text-[13px] text-muted">{[r.displayName, r.serviceLabel, formatDate(r.createdAt)].filter(Boolean).join(' · ')}</p>
                  {r.shopReply && (
                    <div className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[14px] text-ink-2">
                      <p className="text-[12.5px] font-medium text-navy">Réponse de YAMEOGO</p>
                      <p className="mt-1">{r.shopReply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {data.pageCount > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-[14px]">
                {page > 1 && <Link href={`/avis?page=${page - 1}`} className="glass-light rounded-full px-5 py-2.5 font-medium">← Plus récents</Link>}
                <span className="num text-muted">{page} / {data.pageCount}</span>
                {page < data.pageCount && <Link href={`/avis?page=${page + 1}`} className="glass-light rounded-full px-5 py-2.5 font-medium">Plus anciens →</Link>}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
