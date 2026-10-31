import type { PublicSettings } from '@/lib/types';
import { cn } from '@/lib/cn';
import { waLink } from '@/lib/whatsapp';
import { WhatsAppIcon } from './whatsapp';

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.37-2.48V9.66a5.69 5.69 0 0 0-.77-.05 5.69 5.69 0 1 0 5.69 5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-7.6h2.56l.38-2.97H13.5V8.53c0-.86.24-1.45 1.47-1.45h1.57V4.43a21 21 0 0 0-2.29-.12c-2.27 0-3.82 1.38-3.82 3.93v2.19H7.87v2.97h2.56V21h3.07Z" />
    </svg>
  );
}

/** Liens vers les réseaux de la boutique ; un réseau n'apparaît que si son adresse est renseignée. */
export function SocialLinks({ settings, tone = 'light', className, size = 'md', withoutWhatsApp }: { settings: PublicSettings | null; tone?: 'light' | 'dark'; className?: string; size?: 'md' | 'lg'; withoutWhatsApp?: boolean }) {
  const whatsapp = waLink(settings?.whatsapp, `Bonjour ${settings?.shopName ?? 'Le Marchand'},`);
  const links = [
    !withoutWhatsApp && whatsapp && { label: 'WhatsApp', href: whatsapp, Icon: WhatsAppIcon },
    settings?.social?.tiktok && { label: 'TikTok', href: settings.social.tiktok, Icon: TikTokIcon },
    settings?.social?.instagram && { label: 'Instagram', href: settings.social.instagram, Icon: InstagramIcon },
    settings?.social?.facebook && { label: 'Facebook', href: settings.social.facebook, Icon: FacebookIcon },
  ].filter(Boolean) as { label: string; href: string; Icon: typeof WhatsAppIcon }[];

  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="Réseaux sociaux">
      {links.map(({ label, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={cn(
              'inline-flex items-center justify-center rounded-full transition-transform hover:-translate-y-0.5',
              size === 'lg' ? 'size-12' : 'size-10',
              tone === 'light' ? 'glass text-white' : 'glass-light text-navy',
            )}
          >
            <Icon className={size === 'lg' ? 'size-[22px]' : 'size-[18px]'} />
          </a>
        </li>
      ))}
    </ul>
  );
}
