import { z } from 'zod';
import { StepPatch } from '../step/schemas';
import { DayPatch } from '../trip/schemas';

/**
 * Opération d'un lot atomique (POST /api/trips/:id/batch) : modification d'une étape ou d'un jour.
 * Sert aux propositions de réorganisation et à annuler/rétablir.
 */
export type BatchOp =
  { kind: 'step'; id: string; patch: StepPatch } | { kind: 'day'; id: string; patch: DayPatch };

export const BatchRequest = z.object({
  ops: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('step'), id: z.uuid(), patch: StepPatch }),
        z.object({ kind: z.literal('day'), id: z.uuid(), patch: DayPatch }),
      ]),
    )
    .min(1)
    .max(50),
});
export type BatchRequest = z.infer<typeof BatchRequest>;
