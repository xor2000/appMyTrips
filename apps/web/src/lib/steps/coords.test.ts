import { describe, expect, it } from 'vitest';
import { parseLatLng, samePoint } from './coords';

describe('parseLatLng (coordonnées GPS saisies)', () => {
  it('latitude et longitude dans deux champs', () => {
    expect(parseLatLng('48.8606', '2.3376')).toEqual({ lat: 48.8606, lng: 2.3376 });
    expect(parseLatLng(' -33.8568 ', '151.2153')).toEqual({ lat: -33.8568, lng: 151.2153 });
  });

  it('couple « lat, lng » collé dans le premier champ (virgule, espace ou point-virgule)', () => {
    expect(parseLatLng('48.8606, 2.3376')).toEqual({ lat: 48.8606, lng: 2.3376 });
    expect(parseLatLng('48.8606 2.3376')).toEqual({ lat: 48.8606, lng: 2.3376 });
    expect(parseLatLng('48.8606;2.3376', '')).toEqual({ lat: 48.8606, lng: 2.3376 });
  });

  it('refuse les valeurs hors bornes', () => {
    expect(parseLatLng('91', '2')).toBeNull();
    expect(parseLatLng('-90.5', '2')).toBeNull();
    expect(parseLatLng('45', '181')).toBeNull();
    expect(parseLatLng('45', '-180.01')).toBeNull();
    expect(parseLatLng('90', '-180')).toEqual({ lat: 90, lng: -180 });
  });

  it('refuse le texte, les champs vides et les couples incomplets', () => {
    expect(parseLatLng('Paris', '')).toBeNull();
    expect(parseLatLng('', '')).toBeNull();
    expect(parseLatLng('48.86', '')).toBeNull();
    expect(parseLatLng('48.86', 'est')).toBeNull();
    expect(parseLatLng('48.86, 2.33, 7')).toBeNull();
  });
});

describe('samePoint (point du lieu choisi, non déplacé dans la fenêtre)', () => {
  it('ignore l’arrondi à 6 décimales des champs de la fenêtre', () => {
    expect(
      samePoint({ lat: 48.86061234, lng: 2.33764567 }, { lat: 48.860612, lng: 2.337646 }),
    ).toBe(true);
  });

  it('un point déplacé, même un peu, n’est plus le même', () => {
    expect(samePoint({ lat: 48.8606, lng: 2.3376 }, { lat: 48.8607, lng: 2.3376 })).toBe(false);
    expect(samePoint({ lat: 48.8606, lng: 2.3376 }, { lat: 48.8606, lng: 2.33761 })).toBe(false);
  });
});
