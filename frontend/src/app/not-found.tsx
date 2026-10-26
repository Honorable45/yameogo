import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-5 text-white">
      <div className="glass w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <p className="font-mono text-[13px] text-white/60">404</p>
        <h1 className="display mt-2 text-[36px] leading-tight">Page introuvable</h1>
        <p className="mt-3 text-[15px] text-white/75">Le lien est incomplet, ou l’article a été vendu.</p>
        <nav className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            ['/', 'Accueil'],
            ['/boutique', 'Boutique'],
            ['/reparation', 'Devis'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="glass inline-flex h-11 items-center rounded-full px-5 text-[14.5px] font-medium hover:bg-white/25">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
