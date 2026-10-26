import { RepairStatus } from '@prisma/client';

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  RECEIVED: 'Téléphone reçu',
  DIAGNOSING: 'Diagnostic en cours',
  QUOTE_PENDING: 'Devis à confirmer',
  QUOTE_ACCEPTED: 'Devis accepté',
  WAITING_PARTS: 'En attente de pièces',
  IN_PROGRESS: 'Réparation en cours',
  COMPLETED: 'Réparation terminée',
  PICKED_UP: 'Téléphone récupéré',
  CANCELLED: 'Annulée',
};

/**
 * Transitions manuelles. « Devis à confirmer » et « Devis accepté » sont aussi atteints
 * automatiquement par la création et l'acceptation d'un devis.
 */
const TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED: ['DIAGNOSING', 'IN_PROGRESS', 'WAITING_PARTS', 'CANCELLED'],
  DIAGNOSING: ['WAITING_PARTS', 'IN_PROGRESS', 'CANCELLED'],
  QUOTE_PENDING: ['DIAGNOSING', 'CANCELLED'],
  QUOTE_ACCEPTED: ['WAITING_PARTS', 'IN_PROGRESS', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['PICKED_UP', 'IN_PROGRESS'],
  PICKED_UP: [],
  CANCELLED: [],
};

export function allowedRepairTransitions(status: RepairStatus): RepairStatus[] {
  return TRANSITIONS[status];
}

export function canTransitionRepair(from: RepairStatus, to: RepairStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Un dossier clos n'accepte plus de pièces ni de modification de coûts. */
export function isRepairClosed(status: RepairStatus) {
  return status === 'PICKED_UP' || status === 'CANCELLED';
}

/** Une réparation n'est comptée comme réalisée (chiffre d'affaires, statistiques) qu'à ces statuts. */
export const DONE_STATUSES: RepairStatus[] = ['COMPLETED', 'PICKED_UP'];

/** États dans lesquels un devis peut être émis. */
export const QUOTABLE_STATUSES: RepairStatus[] = ['RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'WAITING_PARTS', 'IN_PROGRESS'];
