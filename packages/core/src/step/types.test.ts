import { describe, expect, it } from 'vitest';
import { STEP_TYPES, STEP_TYPE_INFO, defaultDuration } from './types';

describe('types d’étape', () => {
  it('chaque type a un libellé, une couleur et une durée par défaut', () => {
    for (const type of STEP_TYPES) {
      const info = STEP_TYPE_INFO[type];
      expect(info.label, type).toBeTruthy();
      expect(info.color, type).toMatch(/^--type-/);
      expect(info.defaultDurationMin, type).toBeGreaterThanOrEqual(0);
    }
  });

  it('donne les durées par défaut du plan', () => {
    expect(defaultDuration('hotel')).toBe(0);
    expect(defaultDuration('restaurant')).toBe(90);
    expect(defaultDuration('cafe')).toBe(45);
    expect(defaultDuration('museum')).toBe(120);
    expect(defaultDuration('monument')).toBe(45);
    expect(defaultDuration('viewpoint')).toBe(20);
    expect(defaultDuration('airport')).toBe(120);
    expect(defaultDuration('station')).toBe(20);
  });
});
