'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/components/admin/session';
import { DataTable, PageHeader } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/empty-state';
import { Checkbox, Field, FormError, Input, Select } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ROLES } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_HELP: Record<string, string> = {
  MANAGER: 'Accès complet : finances, prix, stocks, utilisateurs, paramètres.',
  TECHNICIAN: 'Dossiers de réparation, diagnostics, devis, pièces et coûts de réparation. Ne voit pas les marges.',
  SELLER: 'Ventes, commandes, consultation du catalogue et des stocks, encaissement et remise des réparations. Ne voit pas les coûts.',
};

function UserDialog({ user, onClose, onSaved }: { user: UserRow | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const me = useSession();
  const { notify } = useToast();
  const u = user && user !== 'new' ? user : null;
  const [form, setForm] = useState({ name: u?.name ?? '', email: u?.email ?? '', role: u?.role ?? 'SELLER', password: '', active: u?.active ?? true });
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const save = async () => {
    setError(null);
    try {
      if (u) await api.patch(`/users/${u.id}`, { name: form.name.trim(), role: form.role, active: form.active, password: form.password || undefined });
      else await api.post('/users', { name: form.name.trim(), email: form.email.trim(), role: form.role, password: form.password });
      notify(u ? 'Compte mis à jour.' : 'Compte créé. Communiquez le mot de passe de façon sûre.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog open onClose={onClose} title={u ? 'Modifier le compte' : 'Nouveau compte'} footer={<Button onClick={save}>Enregistrer</Button>}>
      <div className="space-y-4">
        <Field label="Nom">{(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="E-mail de connexion">{(p) => <Input {...p} type="email" value={form.email} disabled={Boolean(u)} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Rôle" hint={ROLE_HELP[form.role]}>
          {(p) => (
            <Select {...p} value={form.role} disabled={u?.id === me.id} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label={u ? 'Nouveau mot de passe' : 'Mot de passe'} optional={Boolean(u)} hint="10 caractères minimum, lettres et chiffres. Les sessions ouvertes sont fermées en cas de changement.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        {u && u.id !== me.id && <Checkbox checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} label="Compte actif" />}
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data, error, reload } = useResource<UserRow[]>('/users');
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Utilisateurs" actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Nouveau compte</Button>} />
      <div className="rounded-md border border-line bg-surface">
        {!data ? <LoadingBlock /> : (
          <DataTable
            rows={data}
            columns={[
              { key: 'name', header: 'Nom', cell: (u) => <button type="button" onClick={() => setEditing(u)} className="text-left hover:underline"><span className="block font-medium">{u.name}</span><span className="text-[12.5px] text-muted">{u.email}</span></button> },
              { key: 'role', header: 'Rôle', cell: (u) => ROLES[u.role] },
              { key: 'status', header: 'Statut', cell: (u) => <Status tone={u.active ? 'ok' : 'neutral'}>{u.active ? 'Actif' : 'Désactivé'}</Status> },
              { key: 'login', header: 'Dernière connexion', cell: (u) => <span className="num">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}</span> },
            ]}
          />
        )}
      </div>
      <dl className="mt-6 grid gap-4 text-[13.5px] sm:grid-cols-3">
        {Object.entries(ROLE_HELP).map(([k, v]) => (
          <div key={k} className="border-t border-line pt-3">
            <dt className="font-medium">{ROLES[k]}</dt>
            <dd className="mt-1 text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <UserDialog key={editing === 'new' ? 'new' : editing?.id} user={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}
