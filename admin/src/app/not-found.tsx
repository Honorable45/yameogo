import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-[13px] text-faint">Erreur 404</p>
      <h1 className="display text-[30px]">Page introuvable</h1>
      <Link href="/" className="text-[14px] font-medium text-accent underline">
        Retour à la vue d’ensemble
      </Link>
    </main>
  );
}
