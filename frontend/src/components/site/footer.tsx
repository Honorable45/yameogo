import Link from 'next/link';
import type { PublicSettings } from '@/lib/types';
import { formatPhone } from '@/lib/format';
import { directionsUrl } from '@/lib/maps';
import { Logo } from './logo';
import { OpeningHours } from './opening-hours';
import { InstallButton } from './pwa';
import { SocialLinks } from './social';

export function SiteFooter({ settings: s }: { settings: PublicSettings | null }) {
  const address = [s?.addressLine, s?.city].filter(Boolean).join(', ');
  return (
    <footer className="mt-16 bg-navy text-paper sm:mt-24">
      <div className="container-page grid gap-8 py-10 sm:gap-10 sm:py-14 md:grid-cols-3">
        <div>
          <Logo logoUrl={null} name="Le Marchand" inverted />
          <SocialLinks settings={s} className="mt-6" />
          <InstallButton className="mt-5" />
          {s?.phone && <p className="num mt-4 text-[14px] text-paper/80">{formatPhone(s.phone)}</p>}
          {address && <p className="mt-1 text-[14px] text-paper/70">{address}</p>}
          {directionsUrl(s) && (
            <a href={directionsUrl(s)!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[14px] font-medium text-white underline underline-offset-4">
              Itinéraire jusqu’à la boutique
            </a>
          )}
        </div>
        <nav aria-label="Pied de page">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[14.5px]">
            {[
              ['/telephones', 'Smartphones'],
              ['/accessoires', 'Accessoires'],
              ['/promotions', 'Promotions'],
              ['/panier', 'Panier'],
              ['/contact', 'Contact'],
              ['/avis', 'Avis clients'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-paper/85 hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {s?.openingHours.length ? <OpeningHours hours={s.openingHours} inverted /> : null}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-[12.5px] text-paper/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Le Marchand</p>
          <p className="flex gap-5">
            <Link href="/mentions-legales" className="hover:text-paper">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-paper">Confidentialité</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
