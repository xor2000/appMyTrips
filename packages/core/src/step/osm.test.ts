import { describe, expect, it } from 'vitest';
import { stepTypeFromOsm } from './osm';

describe('stepTypeFromOsm', () => {
  it.each([
    ['tourism', 'museum', 'museum'],
    ['tourism', 'gallery', 'museum'],
    ['amenity', 'restaurant', 'restaurant'],
    ['amenity', 'fast_food', 'restaurant'],
    ['amenity', 'cafe', 'cafe'],
    ['tourism', 'hotel', 'hotel'],
    ['tourism', 'guest_house', 'hotel'],
    ['historic', 'castle', 'monument'],
    ['historic', 'memorial', 'monument'],
    ['tourism', 'attraction', 'attraction'],
    ['tourism', 'zoo', 'attraction'],
    ['tourism', 'viewpoint', 'viewpoint'],
    ['leisure', 'park', 'park'],
    ['natural', 'beach', 'beach'],
    ['aeroway', 'aerodrome', 'airport'],
    ['railway', 'station', 'station'],
    ['amenity', 'ferry_terminal', 'port'],
    ['amenity', 'parking', 'parking'],
    ['amenity', 'parking_entrance', 'parking'],
    ['shop', 'bakery', 'shopping'],
  ] as const)('%s=%s → %s', (key, value, expected) => {
    expect(stepTypeFromOsm(key, value)).toBe(expected);
  });

  it('renvoie « other » pour un tag inconnu ou absent', () => {
    expect(stepTypeFromOsm('place', 'city')).toBe('other');
    expect(stepTypeFromOsm(undefined, undefined)).toBe('other');
  });
});
