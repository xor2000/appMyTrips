/** Types d'étape, dans l'ordre d'affichage des menus. */
export const STEP_TYPES = [
  'hotel',
  'restaurant',
  'cafe',
  'museum',
  'monument',
  'attraction',
  'viewpoint',
  'park',
  'beach',
  'shopping',
  'airport',
  'station',
  'port',
  'parking',
  'hike',
  'activity',
  'other',
] as const;

export type StepType = (typeof STEP_TYPES)[number];

export interface StepTypeInfo {
  label: string;
  /** Variable CSS de la couleur du type (tokens du design). */
  color: string;
  /** Durée sur place proposée à la création, en minutes. */
  defaultDurationMin: number;
}

export const STEP_TYPE_INFO: Record<StepType, StepTypeInfo> = {
  hotel: { label: 'Hôtel', color: '--type-hotel', defaultDurationMin: 0 },
  restaurant: { label: 'Restaurant', color: '--type-food', defaultDurationMin: 90 },
  cafe: { label: 'Café', color: '--type-food', defaultDurationMin: 45 },
  museum: { label: 'Musée', color: '--type-museum', defaultDurationMin: 120 },
  monument: { label: 'Monument', color: '--type-poi', defaultDurationMin: 45 },
  attraction: { label: 'Attraction', color: '--type-poi', defaultDurationMin: 120 },
  viewpoint: { label: 'Point de vue', color: '--type-poi', defaultDurationMin: 20 },
  park: { label: 'Parc', color: '--type-hike', defaultDurationMin: 60 },
  beach: { label: 'Plage', color: '--type-air', defaultDurationMin: 120 },
  shopping: { label: 'Shopping', color: '--type-food', defaultDurationMin: 60 },
  airport: { label: 'Aéroport', color: '--type-air', defaultDurationMin: 120 },
  station: { label: 'Gare', color: '--type-air', defaultDurationMin: 20 },
  port: { label: 'Port', color: '--type-air', defaultDurationMin: 30 },
  parking: { label: 'Parking', color: '--type-transport', defaultDurationMin: 10 },
  // Calculée depuis le tracé GPX au lot 6 ; valeur provisoire d'ici là.
  hike: { label: 'Randonnée', color: '--type-hike', defaultDurationMin: 180 },
  activity: { label: 'Activité', color: '--type-poi', defaultDurationMin: 60 },
  other: { label: 'Autre', color: '--type-transport', defaultDurationMin: 60 },
};

export function defaultDuration(type: StepType): number {
  return STEP_TYPE_INFO[type].defaultDurationMin;
}
