import { describe, expect, it } from 'vitest';
import { makePoi } from '#lib/test/fixtures.ts';
import { poiCounts, poiStepInput, sameView } from './explore.ts';

describe('poiStepInput', () => {
  it('pré-remplit l’étape : nom, type, point, adresse, horaires, référence OSM', () => {
    const poi = makePoi({
      address: '107 Rue de Rivoli, 75001 Paris',
      openingHours: 'Tu-Su 11:00-18:00',
    });
    expect(poiStepInput(poi, 'd2')).toEqual({
      dayId: 'd2',
      type: 'museum',
      name: 'Musée des Arts décoratifs',
      lat: 48.863,
      lng: 2.333,
      address: '107 Rue de Rivoli, 75001 Paris',
      openingHours: 'Tu-Su 11:00-18:00',
      osmRef: 'N2001',
      notes: '',
    });
  });

  it('met le site, le téléphone et la cuisine dans les notes', () => {
    const poi = makePoi({
      website: 'https://madparis.fr',
      phone: '+33 1 44 55 57 50',
      cuisine: 'french;bistro',
    });
    expect(poiStepInput(poi, null).notes).toBe(
      'Site : https://madparis.fr\nTél. : +33 1 44 55 57 50\nCuisine : french, bistro',
    );
    expect(poiStepInput(poi, null).dayId).toBeNull();
  });

  it('tronque des horaires trop longs pour le schéma d’étape', () => {
    const poi = makePoi({ openingHours: 'x'.repeat(600) });
    expect(poiStepInput(poi, null).openingHours).toHaveLength(500);
  });
});

describe('poiCounts', () => {
  it('compte les lieux par catégorie', () => {
    const counts = poiCounts([
      makePoi({ id: 'a' }),
      makePoi({ id: 'b' }),
      makePoi({ id: 'c', category: 'cafe', stepType: 'cafe' }),
    ]);
    expect(counts.get('museum')).toBe(2);
    expect(counts.get('cafe')).toBe(1);
    expect(counts.get('park')).toBeUndefined();
  });
});

describe('sameView', () => {
  const view = { bbox: { west: 2.3, south: 48.84, east: 2.38, north: 48.88 }, zoom: 13 };

  it('compare deux vues de carte (tolérance d’arrondi)', () => {
    expect(sameView(view, { ...view, bbox: { ...view.bbox, west: 2.3000001 } })).toBe(true);
    expect(sameView(view, { ...view, bbox: { ...view.bbox, west: 2.31 } })).toBe(false);
    expect(sameView(view, { ...view, zoom: 13.5 })).toBe(false);
    expect(sameView(view, null)).toBe(false);
  });
});
