import type { BatchOp } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { makeDay, makeStep } from '#lib/test/fixtures.ts';
import { createHistory, inverseOps } from './history.ts';

const op = (durationMin: number): BatchOp => ({ kind: 'step', id: 's1', patch: { durationMin } });

describe('createHistory', () => {
  it('annule puis rétablit dans l’ordre', () => {
    const h = createHistory();
    expect(h.canUndo).toBe(false);
    h.push({ label: 'Durée', redo: [op(90)], undo: [op(120)] });
    h.push({ label: 'Durée 2', redo: [op(60)], undo: [op(90)] });
    expect(h.canUndo).toBe(true);
    expect(h.takeUndo()?.label).toBe('Durée 2');
    expect(h.takeUndo()?.label).toBe('Durée');
    expect(h.takeUndo()).toBeNull();
    expect(h.canRedo).toBe(true);
    expect(h.takeRedo()?.label).toBe('Durée');
    expect(h.takeRedo()?.label).toBe('Durée 2');
    expect(h.takeRedo()).toBeNull();
  });

  it('une nouvelle commande efface ce qui pouvait être rétabli', () => {
    const h = createHistory();
    h.push({ label: 'a', redo: [op(1)], undo: [op(2)] });
    h.takeUndo();
    h.push({ label: 'b', redo: [op(3)], undo: [op(4)] });
    expect(h.canRedo).toBe(false);
  });

  it('se vide (après un conflit de version ou un changement de voyage)', () => {
    const h = createHistory();
    h.push({ label: 'a', redo: [op(1)], undo: [op(2)] });
    h.takeUndo();
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('un échec remet la commande à sa place', () => {
    const h = createHistory();
    h.push({ label: 'a', redo: [op(1)], undo: [op(2)] });
    const entry = h.takeUndo()!;
    h.restoreUndo(entry);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });
});

describe('inverseOps', () => {
  const steps = [
    makeStep({ id: 's1', durationMin: 120, fixedStart: null, dayId: 'd1', position: 'a1' }),
  ];
  const days = [makeDay({ id: 'd1', dayStart: null })];

  it('remet les anciennes valeurs des champs modifiés', () => {
    expect(
      inverseOps({ steps, days }, [
        { kind: 'step', id: 's1', patch: { durationMin: 90, fixedStart: '10:00' } },
      ]),
    ).toEqual([{ kind: 'step', id: 's1', patch: { durationMin: 120, fixedStart: null } }]);
  });

  it('un déplacement est inversé avec le jour, le dossier et la position d’origine', () => {
    expect(
      inverseOps({ steps, days }, [{ kind: 'step', id: 's1', patch: { dayId: 'd2' } }]),
    ).toEqual([{ kind: 'step', id: 's1', patch: { dayId: 'd1', parentId: null, position: 'a1' } }]);
  });

  it('option dénivelé d’une randonnée : remise à son ancienne valeur', () => {
    expect(
      inverseOps({ steps, days }, [{ kind: 'step', id: 's1', patch: { useElevation: true } }]),
    ).toEqual([{ kind: 'step', id: 's1', patch: { useElevation: false } }]);
  });

  it('heures du jour : retour à la valeur héritée (null)', () => {
    expect(
      inverseOps({ steps, days }, [{ kind: 'day', id: 'd1', patch: { dayStart: '07:40' } }]),
    ).toEqual([{ kind: 'day', id: 'd1', patch: { dayStart: null } }]);
  });

  it('plusieurs opérations : inverses dans l’ordre inverse', () => {
    const inv = inverseOps({ steps, days }, [
      { kind: 'step', id: 's1', patch: { durationMin: 90 } },
      { kind: 'day', id: 'd1', patch: { dayStart: '07:00' } },
    ]);
    expect(inv.map((o) => o.kind)).toEqual(['day', 'step']);
  });
});
