import { allocateProRata, averageCostAfterRemoval, computeRepairFinancials, settlementStatus, weightedAverageCost } from './money';

describe('Marge brute d’une réparation', () => {
  it('reproduit l’exemple du cahier des charges (15 000 − 6 000 − 500 − 500 = 8 000)', () => {
    const f = computeRepairFinancials({
      billedAmount: 15000,
      parts: [{ totalCost: 6000, status: 'USED' }],
      consumablesCost: 500,
      otherDirectCosts: 500,
    });
    expect(f.directCosts).toBe(7000);
    expect(f.grossMargin).toBe(8000);
  });

  it('additionne plusieurs pièces et ignore les pièces retirées', () => {
    const f = computeRepairFinancials({
      billedAmount: 30000,
      parts: [
        { totalCost: 9000, status: 'USED' },
        { totalCost: 4000, status: 'USED' },
        { totalCost: 18000, status: 'RETURNED' },
      ],
      consumablesCost: 0,
      otherDirectCosts: 1000,
    });
    expect(f.partsCost).toBe(13000);
    expect(f.grossMargin).toBe(16000);
  });

  it('peut être négative (réparation à perte)', () => {
    expect(computeRepairFinancials({ billedAmount: 5000, parts: [{ totalCost: 8000, status: 'USED' }], consumablesCost: 0, otherDirectCosts: 0 }).grossMargin).toBe(-3000);
  });
});

describe('Coût moyen pondéré', () => {
  it('pondère le stock existant et l’entrée', () => {
    expect(weightedAverageCost(3, 1000, 2, 1500)).toBe(1200);
  });
  it('prend le coût de l’entrée si le stock est vide', () => {
    expect(weightedAverageCost(0, 999, 5, 2000)).toBe(2000);
  });
  it('arrondit au franc près', () => {
    expect(weightedAverageCost(2, 1000, 1, 1001)).toBe(1000);
    expect(weightedAverageCost(1, 1000, 2, 1001)).toBe(1001);
  });
  it('reste stable lorsqu’un lot est retiré à son propre coût', () => {
    const avg = weightedAverageCost(4, 1000, 4, 2000); // 1500
    expect(averageCostAfterRemoval(8, avg, 4, 2000)).toBe(1000);
  });
});

describe('Répartition des frais annexes', () => {
  it('répartit au prorata et conserve exactement le total', () => {
    const shares = allocateProRata(1000, [3000, 1000, 2000]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(shares).toEqual([500, 167, 333]);
  });
  it('gère des poids nuls', () => {
    expect(allocateProRata(10, [0, 0, 0]).reduce((a, b) => a + b, 0)).toBe(10);
  });
  it('ne répartit rien si les frais sont nuls', () => {
    expect(allocateProRata(0, [100, 200])).toEqual([0, 0]);
  });
});

describe('Statut de règlement', () => {
  it('distingue non payé, partiel et payé', () => {
    expect(settlementStatus(10000, 0)).toBe('UNPAID');
    expect(settlementStatus(10000, 4000)).toBe('PARTIAL');
    expect(settlementStatus(10000, 10000)).toBe('PAID');
  });
});
