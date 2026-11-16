import { describe, expect, it } from 'vitest';
import {
  countdownLabel,
  dayTabLabel,
  formatDuration,
  formatPeriod,
  formatDistance,
} from './format';

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

describe('formatDuration', () => {
  it('écrit les durées en heures et minutes', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(125)).toBe('2 h 05');
  });
});

describe('formatDistance', () => {
  it('mètres, kilomètres avec une décimale sous 10 km, puis arrondis', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1_234)).toBe('1,2 km');
    expect(formatDistance(12_345)).toBe('12 km');
    expect(formatDistance(72_000)).toBe('72 km');
  });
});
