import type { Place } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { makePoi } from '#lib/test/fixtures.ts';
import { placeResultGroups, poiResultGroups } from './results';

const place = (name: string, type: Place['type']): Place => ({
  name,
  type,
  address: null,
  lat: 48.86,
  lng: 2.34,
  osmRef: null,
});

describe('placeResultGroups (résultats de « Rechercher » groupés par type)', () => {
  it('groupe dans l’ordre des types d’étape, avec libellé et icône du type', () => {
    const groups = placeResultGroups([
      place('Gare du Nord', 'station'),
      place('Musée du Louvre', 'museum'),
      place('Hôtel des Arts', 'hotel'),
      place('Musée d’Orsay', 'museum'),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.icon, g.items.map((p) => p.name)])).toEqual([
      ['hotel', 'Hôtel', 'hotel', ['Hôtel des Arts']],
      ['museum', 'Musée', 'museum', ['Musée du Louvre', 'Musée d’Orsay']],
      ['station', 'Gare', 'station', ['Gare du Nord']],
    ]);
  });

  it('garde les doublons du géocodeur et l’ordre reçu dans un groupe', () => {
    const louvre = place('Musée du Louvre', 'museum');
    const groups = placeResultGroups([louvre, place('Musée Rodin', 'museum'), louvre]);
    expect(groups[0]?.items.map((p) => p.name)).toEqual([
      'Musée du Louvre',
      'Musée Rodin',
      'Musée du Louvre',
    ]);
  });

  it('aucun résultat : aucun groupe', () => {
    expect(placeResultGroups([])).toEqual([]);
  });
});

describe('poiResultGroups (résultats d’« Explorer la zone »)', () => {
  it('groupe par catégorie de la découverte, avec libellé de la catégorie et icône du type', () => {
    const groups = poiResultGroups([
      makePoi({ id: 'a', name: 'Musée Rodin' }),
      makePoi({ id: 'b', name: 'Café Kitsuné', category: 'cafe', stepType: 'cafe' }),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.icon, g.items.map((p) => p.name)])).toEqual([
      ['cafe', 'Cafés', 'cafe', ['Café Kitsuné']],
      ['museum', 'Musées', 'museum', ['Musée Rodin']],
    ]);
  });
});
