import type { PhoneCondition } from './types';

/** Les trois catégories de téléphones vendus, telles qu'expliquées au client. */
export const PHONE_CONDITIONS: Record<PhoneCondition, { label: string; plural: string; slug: string; text: string }> = {
  NEW: { label: 'Neuf', plural: 'Neufs', slug: 'neufs', text: 'Jamais utilisé, emballage d’origine.' },
  IMPORTED: { label: 'Venu', plural: 'Venus', slug: 'venus', text: 'Déjà utilisé, importé d’Europe ou des États-Unis, contrôlé à l’arrivée.' },
  USED: { label: 'Occasion', plural: 'Occasions', slug: 'occasions', text: 'Utilisé localement, contrôlé en atelier avant la vente.' },
};

export const CONDITION_ORDER: PhoneCondition[] = ['NEW', 'IMPORTED', 'USED'];

export function conditionFromSlug(slug: string | undefined): PhoneCondition | undefined {
  return CONDITION_ORDER.find((c) => PHONE_CONDITIONS[c].slug === slug);
}
