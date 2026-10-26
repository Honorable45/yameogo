'use client';

import { useState, type FormEvent } from 'react';
import { PageHeader, Panel, DetailList } from '@/components/admin/ui';
import { useSession } from '@/components/admin/session';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { ROLES } from '@/lib/labels';

export default function AccountPage() {
  const user = useSession();
  const { notify } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) return setError('Les deux nouveaux mots de passe ne correspondent pas.');
    setSaving(true);
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: next });
      notify('Mot de passe modifié. Vos autres sessions ont été fermées.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profil">
          <DetailList items={[['Nom', user.name], ['E-mail', user.email], ['Rôle', ROLES[user.role]]]} />
        </Panel>
        <Panel title="Changer de mot de passe">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Mot de passe actuel">{(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}</Field>
            <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec des lettres et des chiffres.">
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />}
            </Field>
            <Field label="Confirmer le nouveau mot de passe">{(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}</Field>
            <FormError message={error} />
            <Button type="submit" loading={saving}>
              Enregistrer
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
