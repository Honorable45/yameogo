'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'MANAGER' | 'TECHNICIAN' | 'SELLER';
  permissions: string[];
}

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const user = useContext(SessionContext);
  if (!user) throw new Error('useSession hors de SessionProvider');
  return user;
}

/** Adapte l'affichage aux droits ; le serveur reste seul juge des autorisations. */
export function useCan() {
  const user = useSession();
  return (permission: string) => user.permissions.includes(permission);
}

export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  return useCan()(permission) ? <>{children}</> : null;
}
