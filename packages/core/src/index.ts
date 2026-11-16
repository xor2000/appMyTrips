import { z } from 'zod';

/** Identifiant d'un voyage (UUID). */
export const TripId = z.uuid();
export type TripId = z.infer<typeof TripId>;

/** Adresse e-mail normalisée (sans espaces, en minuscules). */
export const Email = z.string().trim().toLowerCase().pipe(z.email());
export type Email = z.infer<typeof Email>;

export * from './trip/days';
export * from './trip/schemas';
export * from './step/order';
export * from './step/schemas';
export * from './step/timeline';
export * from './step/types';
export * from './step/osm';
export * from './poi/categories';
export * from './poi/tiles';
export * from './poi/types';
export * from './poi/overpass';
export * from './poi/geoapify';
export * from './poi/rank';
