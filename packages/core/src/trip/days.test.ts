import { describe, expect, it } from 'vitest';
import { datesInPeriod, diffPeriod } from './days';

describe('datesInPeriod', () => {
  it('renvoie un seul jour quand début et fin sont identiques', () => {
    expect(datesInPeriod('2026-07-10', '2026-07-10')).toEqual(['2026-07-10']);
  });

  it('renvoie tous les jours de la période, bornes incluses', () => {
    expect(datesInPeriod('2026-07-10', '2026-07-12')).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('passe correctement d’un mois et d’une année à l’autre', () => {
    expect(datesInPeriod('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('tient compte du 29 février des années bissextiles', () => {
    expect(datesInPeriod('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
    expect(datesInPeriod('2027-02-28', '2027-03-01')).toEqual(['2027-02-28', '2027-03-01']);
  });

  it('ne dépend pas du changement d’heure', () => {
    expect(datesInPeriod('2026-03-28', '2026-03-30')).toHaveLength(3);
    expect(datesInPeriod('2026-10-24', '2026-10-26')).toHaveLength(3);
  });

  it('refuse une fin antérieure au début', () => {
    expect(() => datesInPeriod('2026-07-12', '2026-07-10')).toThrow();
  });
});

describe('diffPeriod', () => {
  const current = ['2026-07-10', '2026-07-11', '2026-07-12'];

  it('ne change rien quand la période est identique', () => {
    expect(diffPeriod(current, '2026-07-10', '2026-07-12')).toEqual({ toAdd: [], toRemove: [] });
  });

  it('ajoute les jours d’une période allongée', () => {
    expect(diffPeriod(current, '2026-07-09', '2026-07-13')).toEqual({
      toAdd: ['2026-07-09', '2026-07-13'],
      toRemove: [],
    });
  });

  it('retire les jours d’une période raccourcie', () => {
    expect(diffPeriod(current, '2026-07-11', '2026-07-11')).toEqual({
      toAdd: [],
      toRemove: ['2026-07-10', '2026-07-12'],
    });
  });

  it('gère une période entièrement déplacée', () => {
    expect(diffPeriod(current, '2026-08-01', '2026-08-02')).toEqual({
      toAdd: ['2026-08-01', '2026-08-02'],
      toRemove: current,
    });
  });
});
