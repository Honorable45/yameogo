import type { Metadata } from 'next';
import Link from 'next/link';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';
import { formatPhone } from '@/lib/format';
import { LegalLayout } from '@/components/site/legal-layout';

export const metadata: Metadata = { title: 'Mentions légales', alternates: { canonical: '/mentions-legales' } };

export default async function LegalPage() {
  const s = await serverGet<PublicSettings>('/settings/public', 300);
  const l = s?.legal;
  const rows: [string, string | null | undefined][] = [
    ['Dénomination', l?.legalName || s?.shopName],
    ['Forme juridique', l?.legalForm],
    ['Immatriculation (RCCM)', l?.registrationNumber],
    ['Identifiant fiscal', l?.taxId],
    ['Adresse', [s?.addressLine, s?.city, s?.country].filter(Boolean).join(', ') || null],
    ['Téléphone', s?.phone ? formatPhone(s.phone) : null],
    ['E-mail', s?.email],
    ['Directeur de la publication', l?.publicationDirector],
  ];

  return (
    <LegalLayout title="Mentions légales">
      <section>
        <h2>Éditeur du site</h2>
        <dl className="divide-y divide-line">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[12rem_1fr] gap-4 py-2.5 text-[14.5px]">
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
        </dl>
      </section>
      {l?.hostingProvider && (
        <section>
          <h2>Hébergement</h2>
          <p className="whitespace-pre-line">{l.hostingProvider}</p>
        </section>
      )}
      <section>
        <h2>Prix</h2>
        <p>Les prix sont indiqués en francs CFA (XOF). Les commandes se concluent sur WhatsApp. Les estimations de réparation sont indicatives et confirmées après diagnostic.</p>
      </section>
      <section>
        <h2>Photographies</h2>
        <p>Les photographies des téléphones d’occasion représentent l’appareil vendu. Certaines illustrations proviennent de la banque d’images Unsplash (licence Unsplash).</p>
      </section>
      <section>
        <h2>Données personnelles</h2>
        <p>
          Voir la page{' '}
          <Link href="/confidentialite" className="text-accent underline">
            Confidentialité
          </Link>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
