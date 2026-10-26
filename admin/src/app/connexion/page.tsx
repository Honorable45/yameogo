'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/field';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/login', { email, password });
      const next = search.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="Adresse e-mail">{(p) => <Input {...p} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
      <Field label="Mot de passe">{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
      <FormError message={error} />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <a href="/" className="flex items-baseline gap-2">
          <span className="flex items-center uppercase leading-none text-ink">
            <span className="text-[16px] font-semibold tracking-[0.2em]">Yameogo</span>
            <span className="mx-1.5 inline-block size-[5px] rounded-full bg-accent" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-[0.3em] text-ink-2">Smart Tech</span>
          </span>
        </a>
        <div className="mx-auto w-full max-w-sm py-12">
          <p className="eyebrow">Espace équipe</p>
          <h1 className="display mt-2 text-[34px]">Connexion</h1>
          <p className="mt-2 text-[14.5px] text-muted">Réservé au personnel de la boutique.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-[12.5px] text-faint">Mot de passe oublié : demandez au Responsable de le réinitialiser.</p>
      </div>
      <div className="hidden bg-ink lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="max-w-md text-paper">
          <p className="display text-[30px] leading-tight">Catalogue, ventes et stocks, au même endroit.</p>
          <ul className="mt-8 space-y-3 text-[14.5px] text-paper/70">
            <li>— Chaque produit a ses configurations, avec leur prix et leur stock.</li>
            <li>— Les marges sont calculées à partir des coûts réellement enregistrés.</li>
            <li>— Les stocks bougent uniquement par des opérations traçables.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
