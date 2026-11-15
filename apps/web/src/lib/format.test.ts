import { describe, expect, it } from 'vitest';
import { countdownLabel, dayTabLabel, formatPeriod } from './format';

describe('formatPeriod', () => {
  it('regroupe le mois et l’année quand ils sont communs', () => {
    expect(formatPeriod('2026-07-10', '2026-07-12')).toBe('10 – 12 juillet 2026');
  });

  it('affiche une seule date pour un voyage d’un jour', () => {
    expect(formatPeriod('2026-07-10', '2026-07-10')).toBe('10 juillet 2026');
  });

  it('affiche les deux mois quand la période change de mois', () => {
    expect(formatPeriod('2026-06-30', '2026-07-02')).toBe('30 juin – 2 juillet 2026');
  });

  it('affiche les deux années quand la période change d’année', () => {
    expect(formatPeriod('2026-12-30', '2027-01-02')).toBe('30 décembre 2026 – 2 janvier 2027');
  });
});

describe('countdownLabel', () => {
  it('compte les jours avant le départ', () => {
    expect(countdownLabel('2026-07-10', '2026-07-12', '2026-06-17')).toBe('Dans 23 jours');
  });

  it('dit « Demain » la veille du départ', () => {
    expect(countdownLabel('2026-07-10', '2026-07-12', '2026-07-09')).toBe('Demain');
  });

  it('dit « En cours » pendant le voyage, bornes incluses', () => {
    expect(countdownLabel('2026-07-10', '2026-07-12', '2026-07-10')).toBe('En cours');
    expect(countdownLabel('2026-07-10', '2026-07-12', '2026-07-12')).toBe('En cours');
  });

  it('dit « Terminé » après le voyage', () => {
    expect(countdownLabel('2026-07-10', '2026-07-12', '2026-07-13')).toBe('Terminé');
  });
});

describe('dayTabLabel', () => {
  it('donne le jour de la semaine et la date courte', () => {
    expect(dayTabLabel('2026-07-10')).toBe('ven. 10 juil.');
  });
});
