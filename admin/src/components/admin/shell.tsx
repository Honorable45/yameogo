'use client';
import { useSiteUrl } from '@/lib/site-url';

import { ChevronDown, ExternalLink, LogOut, Menu, Plus, Search, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ROLES } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';
import { PRIMARY_NAV, QUICK_ACTIONS, SECONDARY_NAV, type NavItem } from './nav';
import { CommandPalette } from './command-palette';
import { useSession } from './session';

type Queue = Record<string, number | null>;

function Sidebar({ queue, onNavigate }: { queue: Queue | undefined; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useSession();
  const router = useRouter();
  const can = (p?: string) => !p || user.permissions.includes(p);
  const primary = PRIMARY_NAV.filter((i) => can(i.permission));
  const secondary = SECONDARY_NAV.filter((i) => can(i.permission));
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));
  const [more, setMore] = useState(() => secondary.some(isActive));
  const secondaryCount = secondary.reduce((acc, i) => acc + (i.badge ? (queue?.[i.badge] ?? 0) : 0), 0);

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    const count = item.badge ? queue?.[item.badge] : null;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn('flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors', active ? 'bg-navy font-medium text-white' : 'text-ink-2 hover:bg-paper hover:text-ink')}
        >
          <item.icon className={cn('size-[18px] shrink-0', active ? 'text-white' : 'text-muted')} strokeWidth={1.75} />
          <span className="flex-1 truncate">{item.label}</span>
          {count ? <span className={cn('num rounded-full px-1.5 py-px text-[11px] font-semibold', active ? 'bg-white text-navy' : 'bg-ochre text-white')}>{count}</span> : null}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <Link href="/" onClick={onNavigate} className="flex items-baseline gap-2">
          <span className="font-serif text-[23px] font-semibold leading-none tracking-[-0.02em]">TH</span>
          <span className="text-[10.5px] font-medium uppercase tracking-[0.26em] text-ink-2">Store</span>
        </Link>
      </div>
      <nav aria-label="Administration" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">{primary.map(renderItem)}</ul>
        {secondary.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-[12.5px] font-medium text-muted hover:text-ink">
              <ChevronDown className={cn('size-3.5 transition-transform', !more && '-rotate-90')} />
              Plus
              {!more && secondaryCount > 0 && <span className="num ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{secondaryCount}</span>}
            </button>
            {more && <ul className="mt-1 space-y-0.5">{secondary.map(renderItem)}</ul>}
          </div>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white" aria-hidden="true">
            {user.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{user.name}</p>
            <p className="text-[12px] text-muted">{ROLES[user.role]}</p>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <Link href="/compte" onClick={onNavigate} className="flex h-8 items-center justify-center gap-1.5 rounded-sm text-[12.5px] text-ink-2 hover:bg-paper">
            <UserRound className="size-3.5" /> Mon compte
          </Link>
          <button
            type="button"
            onClick={async () => {
              await api.post('/auth/logout').catch(() => undefined);
              router.replace('/connexion');
            }}
            className="flex h-8 items-center justify-center gap-1.5 rounded-sm text-[12.5px] text-ink-2 hover:bg-paper"
          >
            <LogOut className="size-3.5" /> Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = QUICK_ACTIONS.filter((a) => user.permissions.includes(a.permission));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-3 text-[13.5px] font-medium text-white hover:bg-accent-ink">
        <Plus className="size-4" />
        <span className="hidden sm:inline">Nouveau</span>
        <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-72 animate-fade-in rounded-md border border-line bg-surface p-1.5 shadow-pop">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} role="menuitem" onClick={() => setOpen(false)} className="flex h-10 items-center gap-3 rounded-sm px-3 text-[14px] text-ink hover:bg-paper">
              <a.icon className="size-4 text-muted" strokeWidth={1.75} />
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const siteUrl = useSiteUrl();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const { data: overview, reload } = useResource<{ queue: Queue }>('/stats/overview');

  useEffect(() => setDrawer(false), [pathname]);
  // Les compteurs sont rafraîchis à chaque changement de page et toutes les 2 minutes.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    const t = setInterval(reload, 120_000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-surface lg:block">
        <Sidebar queue={overview?.queue} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] animate-slide-in bg-surface shadow-pop">
            <button type="button" onClick={() => setDrawer(false)} aria-label="Fermer" className="absolute right-2 top-3 z-10 inline-flex size-10 items-center justify-center rounded-sm text-muted">
              <X className="size-5" />
            </button>
            <Sidebar queue={overview?.queue} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur-[2px] sm:px-6 lg:px-8">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" className="-ml-2 inline-flex size-10 items-center justify-center rounded-sm text-ink hover:bg-paper-2 lg:hidden">
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-sm border border-line bg-surface px-3 text-left text-[13.5px] text-faint transition-colors hover:border-line-2 sm:max-w-md"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate">
              <span className="sm:hidden">Rechercher…</span>
              <span className="hidden sm:inline">Rechercher un dossier, un client, un article…</span>
            </span>
            <kbd className="hidden rounded-xs border border-line px-1.5 font-mono text-[11px] text-muted sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="hidden h-9 items-center gap-1.5 rounded-sm px-2.5 text-[13.5px] text-ink-2 hover:bg-paper-2 md:inline-flex">
              Voir le site <ExternalLink className="size-3.5" />
            </a>
            <QuickActions />
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
