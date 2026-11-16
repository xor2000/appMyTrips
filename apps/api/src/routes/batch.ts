import { BatchRequest } from '@mytrips/core';
import type { Context, Hono } from 'hono';
import { pruneStaleLegs } from '../db/legs';
import { getStep } from '../db/steps';
import { getSnapshot, getTrip } from '../db/trips';
import { planDayUpdate, planStepUpdate, type Plan } from './plans';
import {
  access,
  parseBody,
  requireVersion,
  versionConflict,
  writeWithVersion,
  type TripsEnv,
} from './shared';

/**
 * Lot atomique : plusieurs modifications d'étapes et de jours en une seule version du voyage
 * (propositions de réorganisation, annuler/rétablir). Tout est validé avant d'écrire ; une
 * opération invalide n'applique rien.
 */
export function registerBatchRoute(trips: Hono<TripsEnv>) {
  trips.post('/:id/batch', access('write'), async (c: Context<TripsEnv>) => {
    const id = c.req.param('id') ?? '';
    const db = c.env.DB;
    const body = await parseBody(c, BatchRequest);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const trip = await getTrip(db, id);
    if (!trip) return c.json({ error: 'not_found' }, 404);

    const plans: Plan[] = [];
    for (const op of body.data.ops) {
      if (op.kind === 'step') {
        const step = await getStep(db, id, op.id);
        if (!step) return c.json({ error: 'not_found' }, 404);
        plans.push(await planStepUpdate(db, id, step, op.patch));
      } else {
        plans.push(await planDayUpdate(db, trip, op.id, op.patch));
      }
      const last = plans[plans.length - 1]!;
      if ('error' in last) return c.json(last.error.body, last.error.status);
    }

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) =>
      plans.flatMap((p) => ('statements' in p ? p.statements(guard, g) : [])),
    );
    if (!ok) return versionConflict(c, id);
    await pruneStaleLegs(db, id);
    return c.json(await getSnapshot(db, id, c.get('role')));
  });
}
