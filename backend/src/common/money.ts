import { SettlementStatus } from '@prisma/client';

/**
 * Règles monétaires.
 * Le franc CFA (XOF) n'a pas de subdivision : tous les montants sont des entiers.
 * Les arrondis (coût moyen, répartition de frais) se font à l'entier le plus proche.
 */

export function assertAmount(value: number, label = 'Montant'): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} invalide : un entier positif en XOF est attendu.`);
  }
  return value;
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function settlementStatus(total: number, paid: number): SettlementStatus {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}

/**
 * Coût moyen pondéré après une entrée en stock.
 * Si le stock existant est nul (ou négatif par incohérence passée), le coût de l'entrée fait foi.
 */
export function weightedAverageCost(
  currentQty: number,
  currentAvg: number,
  incomingQty: number,
  incomingUnitCost: number,
): number {
  if (incomingQty <= 0) return currentAvg;
  if (currentQty <= 0) return incomingUnitCost;
  return Math.round((currentQty * currentAvg + incomingQty * incomingUnitCost) / (currentQty + incomingQty));
}

/**
 * Coût moyen après la sortie d'un lot valorisé à un coût précis (annulation d'achat).
 * Si le stock restant est nul, on conserve le coût moyen précédent comme référence.
 */
export function averageCostAfterRemoval(
  currentQty: number,
  currentAvg: number,
  removedQty: number,
  removedUnitCost: number,
): number {
  const remaining = currentQty - removedQty;
  if (remaining <= 0) return currentAvg;
  const value = currentQty * currentAvg - removedQty * removedUnitCost;
  return Math.max(0, Math.round(value / remaining));
}

/**
 * Répartit des frais annexes sur des lignes au prorata de leur valeur.
 * La somme des parts est exactement égale aux frais (le reliquat d'arrondi va aux plus grosses lignes).
 */
export function allocateProRata(total: number, weights: number[]): number[] {
  const weightSum = sum(weights);
  if (total === 0 || weights.length === 0) return weights.map(() => 0);
  if (weightSum === 0) {
    const base = Math.floor(total / weights.length);
    const shares = weights.map(() => base);
    for (let i = 0; i < total - base * weights.length; i++) shares[i] += 1;
    return shares;
  }
  const raw = weights.map((w) => (total * w) / weightSum);
  const shares = raw.map(Math.floor);
  let remainder = total - sum(shares);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || weights[b.i] - weights[a.i]);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) shares[order[k].i] += 1;
  return shares;
}

export interface RepairCostInput {
  billedAmount: number;
  parts: { totalCost: number; status: 'USED' | 'RETURNED' }[];
  consumablesCost: number;
  otherDirectCosts: number;
}

export interface RepairFinancials {
  billedAmount: number;
  partsCost: number;
  consumablesCost: number;
  otherDirectCosts: number;
  directCosts: number;
  grossMargin: number;
}

/**
 * Marge brute d'une réparation :
 * montant facturé − pièces utilisées − consommables − autres coûts directs.
 * Les pièces retirées (RETURNED) ne sont pas comptées.
 */
export function computeRepairFinancials(input: RepairCostInput): RepairFinancials {
  const partsCost = sum(input.parts.filter((p) => p.status === 'USED').map((p) => p.totalCost));
  const directCosts = partsCost + input.consumablesCost + input.otherDirectCosts;
  return {
    billedAmount: input.billedAmount,
    partsCost,
    consumablesCost: input.consumablesCost,
    otherDirectCosts: input.otherDirectCosts,
    directCosts,
    grossMargin: input.billedAmount - directCosts,
  };
}
