import { randomInt } from 'node:crypto';
import { Tx } from '../prisma/prisma.service';

/**
 * Incrémente atomiquement un compteur et renvoie la nouvelle valeur.
 * INSERT … ON CONFLICT garantit l'unicité même en cas d'appels simultanés.
 */
export async function nextCounter(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

/** Numéro lisible annuel : PREFIX-AAAA-00001 */
export async function nextYearlyNumber(tx: Tx, prefix: string, date = new Date(), pad = 5): Promise<string> {
  const year = date.getUTCFullYear();
  const value = await nextCounter(tx, `${prefix}-${year}`);
  return `${prefix}-${year}-${String(value).padStart(pad, '0')}`;
}

// Sans 0/O ni 1/I/L : lisible et dictable sans confusion.
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Référence d'article aléatoire : PREFIX-7K3QX9.
 * Contrairement à un compteur (TEL-0001, TEL-0002…), elle ne révèle ni le volume du stock
 * ni les références voisines, et ne permet pas de parcourir les fiches publiques.
 * `exists` vérifie l'unicité (31⁶ ≈ 887 millions de combinaisons : collisions rarissimes).
 */
export async function randomReference(prefix: string, exists: (reference: string) => Promise<boolean>, length = 6): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < length; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
    const reference = `${prefix}-${code}`;
    if (!(await exists(reference))) return reference;
  }
  throw new Error('Impossible de générer une référence unique.');
}
