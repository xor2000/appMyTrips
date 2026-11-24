import { STEP_TYPES } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { stepIconSvg } from './poiIcons';

describe('icônes des pastilles de la découverte', () => {
  it('SVG autonome de l’icône du type, à la taille et dans la couleur demandées', () => {
    const svg = stepIconSvg('museum', '#ffffff', 26);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="26"');
    expect(svg).toContain('stroke="#ffffff"');
  });

  it('une icône distincte pour chaque type d’étape', () => {
    const svgs = STEP_TYPES.map((t) => stepIconSvg(t, '#ffffff', 26));
    expect(
      svgs.every((s) => s.includes('<path') || s.includes('<rect') || s.includes('<circle')),
    ).toBe(true);
    // Certains types partagent une icône (hôtel et séjour) ; au moins une douzaine de distinctes.
    expect(new Set(svgs).size).toBeGreaterThanOrEqual(12);
  });
});
