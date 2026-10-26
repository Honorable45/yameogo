'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin/shell';
import { SessionProvider, type SessionUser } from '@/components/admin/session';
import { LoadingBlock } from '@/components/ui/spinner';
import { useResource } from '@/lib/use-resource';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, error } = useResource<{ user: SessionUser }>('/auth/me');

  useEffect(() => {
    if (error) router.replace(`/connexion?next=${encodeURIComponent(window.location.pathname)}`);
  }, [error, router]);

  useEffect(() => {
    document.title = 'Gestion · YAMEOGO';
  }, []);

  if (!data) return <LoadingBlock className="min-h-dvh" label="Ouverture de la session…" />;
  return (
    <SessionProvider user={data.user}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
