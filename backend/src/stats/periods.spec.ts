import { bucketsOf, resolvePeriod } from './periods';

// Mercredi 21 octobre 2026, 10 h 30 à Lomé (UTC+0).
const NOW = new Date('2026-10-21T10:30:00Z');

describe('Périodes statistiques (fuseau Africa/Lome)', () => {
  it('aujourd’hui : de minuit à minuit, fin exclue', () => {
    const p = resolvePeriod('today', 'Africa/Lome', NOW);
    expect(p.start.toISOString()).toBe('2026-10-21T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(p.previous.startDate).toBe('2026-10-20');
  });

  it('la semaine commence le lundi', () => {
    const p = resolvePeriod('this_week', 'Africa/Lome', NOW);
    expect(p.startDate).toBe('2026-10-19');
    expect(p.endDate).toBe('2026-10-25');
    const last = resolvePeriod('last_week', 'Africa/Lome', NOW);
    expect(last.startDate).toBe('2026-10-12');
    expect(last.endDate).toBe('2026-10-18');
  });

  it('mois précédent et comparaison', () => {
    const p = resolvePeriod('last_month', 'Africa/Lome', NOW);
    expect(p.startDate).toBe('2026-09-01');
    expect(p.endDate).toBe('2026-09-30');
    expect(p.previous.startDate).toBe('2026-08-01');
    expect(p.granularity).toBe('day');
  });

  it('année : granularité mensuelle, 12 intervalles', () => {
    const p = resolvePeriod('this_year', 'Africa/Lome', NOW);
    expect(p.granularity).toBe('month');
    expect(bucketsOf(p)).toHaveLength(12);
    expect(bucketsOf(p)[0]).toBe('2026-01');
  });

  it('respecte un fuseau différent d’UTC', () => {
    // À Paris (UTC+2 en octobre), « aujourd’hui » commence à 22 h UTC la veille.
    const p = resolvePeriod('today', 'Europe/Paris', NOW);
    expect(p.start.toISOString()).toBe('2026-10-20T22:00:00.000Z');
  });

  it('période personnalisée : bornes incluses et contrôles', () => {
    const p = resolvePeriod('custom', 'Africa/Lome', NOW, { from: '2026-10-01', to: '2026-10-10' });
    expect(bucketsOf(p)).toHaveLength(10);
    expect(p.previous.startDate).toBe('2026-09-21');
    expect(() => resolvePeriod('custom', 'Africa/Lome', NOW, { from: '2026-10-10', to: '2026-10-01' })).toThrow();
    expect(() => resolvePeriod('custom', 'Africa/Lome', NOW, { from: '2026-02-30', to: '2026-03-01' })).toThrow();
  });
});
