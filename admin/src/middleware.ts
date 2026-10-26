import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirige vers la page de connexion si aucun cookie de session n'est présent.
 * Ce n'est qu'un confort de navigation : chaque appel à l'API vérifie la session et les droits.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/connexion') && !req.cookies.get('ymg_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Toutes les pages sauf le relais API et les fichiers techniques.
export const config = { matcher: ['/((?!api|_next|icon.svg|favicon.ico).*)'] };
