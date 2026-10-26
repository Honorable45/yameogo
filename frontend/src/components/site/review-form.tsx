'use client';

import { BadgeCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Textarea } from '@/components/ui/field';

function RatingInput({ label, value, onChange, required }: { label: string; value: number; onChange: (v: number) => void; required?: boolean }) {
  const words = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];
  return (
    <fieldset>
      <legend className="text-[14px] font-medium text-ink">
        {label}
        {!required && <span className="ml-1.5 text-[12.5px] font-normal text-faint">facultatif</span>}
      </legend>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="flex size-11 items-center justify-center rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent" aria-hidden="true">
              <Star className={cn('size-7 transition-colors', n <= value ? 'fill-ochre text-ochre' : 'text-line-2')} strokeWidth={1.4} />
            </span>
            <span className="sr-only">
              {n} sur 5 — {words[n]}
            </span>
          </label>
        ))}
        <span className="ml-2 text-[13.5px] text-muted" aria-hidden="true">
          {words[value]}
        </span>
      </div>
    </fieldset>
  );
}

type Checked = { serviceType: 'ACCESSORY_PURCHASE' | 'PHONE_PURCHASE'; subject: string };

/**
 * Avis client en deux temps : le code remis par la boutique (obligatoire), puis la note.
 * Le code est vérifié avant la saisie ; l'avis est publié dès l'envoi.
 */
export function ReviewForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingWelcome, setRatingWelcome] = useState(0);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const check = async (value: string) => {
    if (value.replace(/[^a-z0-9]/gi, '').length < 8) return setCodeError('Saisissez le code à 8 caractères reçu de la boutique.');
    setChecking(true);
    setCodeError(null);
    try {
      setChecked(await api.get<Checked>(`/reviews/check-code?code=${encodeURIComponent(value.trim())}`));
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (initialCode) void check(initialCode);
  }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return setError('Choisissez une note générale.');
    setSending(true);
    setError(null);
    try {
      await api.post('/reviews', {
        rating,
        ratingWelcome: ratingWelcome || undefined,
        ratingValue: ratingValue || undefined,
        comment: comment.trim() || undefined,
        displayName: displayName.trim() || undefined,
        code: code.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="animate-slide-up text-center">
        <h2 className="display text-[28px]">Merci pour votre avis !</h2>
        <p className="mt-3 text-[15px] text-ink-2">Il est publié sur le site.</p>
        <Link href="/avis" className="mt-6 inline-block text-[14.5px] font-medium text-accent underline">
          Voir les avis
        </Link>
      </div>
    );
  }

  if (!checked) {
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check(code);
        }}
        className="space-y-5"
      >
        <Field label="Votre code d’avis" error={codeError} hint="Imprimé sur votre ticket de caisse ou envoyé par la boutique sur WhatsApp après votre achat.">
          {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoComplete="off" autoCapitalize="characters" className="font-mono text-[18px] uppercase tracking-[0.2em]" maxLength={16} placeholder="ABCD-2345" />}
        </Field>
        <Button type="submit" size="lg" loading={checking} className="w-full">
          Continuer
        </Button>
        <p className="text-center text-[13px] text-muted">Pas de code ? Demandez-le à la boutique sur WhatsApp.</p>
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      <p className="flex items-start gap-2.5 border-l-2 border-ok bg-ok-soft px-4 py-3 text-[14.5px] text-ok">
        <BadgeCheck className="mt-0.5 size-4 shrink-0" />
        <span>{checked.subject}</span>
      </p>

      <RatingInput label="Note générale" value={rating} onChange={setRating} required />
      <RatingInput label="Accueil" value={ratingWelcome} onChange={setRatingWelcome} />
      <RatingInput label="Rapport qualité-prix" value={ratingValue} onChange={setRatingValue} />

      <Field label="Commentaire" optional>
        {(p) => <Textarea {...p} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />}
      </Field>
      <Field label="Prénom ou pseudonyme affiché" optional hint="Laissez vide pour publier anonymement.">
        {(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />}
      </Field>

      <FormError message={error} />
      <Button type="submit" size="lg" loading={sending} className="w-full">
        Publier mon avis
      </Button>
    </form>
  );
}
