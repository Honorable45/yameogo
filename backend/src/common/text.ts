export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Normalise un numéro de téléphone pour l'identification des clients :
 * conserve un éventuel « + » initial et les chiffres ; « 00 » initial devient « + ».
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/** Masque un numéro pour un affichage public : +228 •• •• 45 67 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return `•••• ${digits.slice(-4)}`;
}

export function cleanOptional(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
