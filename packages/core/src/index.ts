import { z } from 'zod';

/** Identifiant d'un voyage (UUID). */
export const TripId = z.uuid();
export type TripId = z.infer<typeof TripId>;

/** Adresse e-mail normalisée (sans espaces, en minuscules). */
export const Email = z.string().trim().toLowerCase().pipe(z.email());
export type Email = z.infer<typeof Email>;
