import type { StepType } from './types';

const BY_TAG: Record<string, StepType> = {
  'tourism=museum': 'museum',
  'tourism=gallery': 'museum',
  'amenity=restaurant': 'restaurant',
  'amenity=fast_food': 'restaurant',
  'amenity=cafe': 'cafe',
  'amenity=bar': 'cafe',
  'tourism=hotel': 'hotel',
  'tourism=hostel': 'hotel',
  'tourism=guest_house': 'hotel',
  'tourism=motel': 'hotel',
  'tourism=apartment': 'hotel',
  'tourism=chalet': 'hotel',
  'tourism=camp_site': 'hotel',
  'tourism=attraction': 'attraction',
  'tourism=theme_park': 'attraction',
  'tourism=zoo': 'attraction',
  'tourism=aquarium': 'attraction',
  'tourism=viewpoint': 'viewpoint',
  'tourism=artwork': 'monument',
  'leisure=park': 'park',
  'leisure=garden': 'park',
  'natural=beach': 'beach',
  'aeroway=aerodrome': 'airport',
  'railway=station': 'station',
  'railway=halt': 'station',
  'public_transport=station': 'station',
  'amenity=ferry_terminal': 'port',
  'amenity=parking': 'parking',
  'amenity=parking_entrance': 'parking',
};

/** Type d'étape deviné depuis un tag OpenStreetMap (clé=valeur), « other » par défaut. */
export function stepTypeFromOsm(key: string | undefined, value: string | undefined): StepType {
  if (!key) return 'other';
  const exact = BY_TAG[`${key}=${value}`];
  if (exact) return exact;
  if (key === 'historic') return 'monument';
  if (key === 'shop') return 'shopping';
  return 'other';
}
