import { describe, expect, it } from 'vitest';
import { LEG_COLOR_COUNT, dayLegColors, legColorVar } from './colors';

describe('couleurs des trajets', () => {
  it('palette de 8 couleurs (celle des couches de la maquette), en variables CSS du thème', () => {
    expect(LEG_COLOR_COUNT).toBe(8);
    expect(legColorVar(0)).toBe('--leg-1');
    expect(legColorVar(7)).toBe('--leg-8');
  });

  it('automatique : chaque trajet du jour prend la couleur suivante, en boucle', () => {
    const auto = Array.from({ length: 10 }, () => ({ color: null }));
    expect(dayLegColors(auto)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
  });

  it('couleur choisie gardée ; le trajet automatique suivant prend la couleur d’après', () => {
    expect(dayLegColors([{ color: null }, { color: 5 }, { color: null }, { color: null }])).toEqual(
      [0, 5, 6, 7],
    );
    expect(dayLegColors([{ color: 7 }, { color: null }])).toEqual([7, 0]);
  });

  it('aucun trajet : liste vide', () => {
    expect(dayLegColors([])).toEqual([]);
  });
});
