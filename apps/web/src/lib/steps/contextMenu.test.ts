import { describe, expect, it, vi } from 'vitest';
import { days, makeStep } from '#lib/test/fixtures.ts';
import { googleMapsUrl, moveTargets, moveToEndOp, stepMenuEntries } from './contextMenu';

describe('stepMenuEntries (menu contextuel d’un lieu ou d’un dossier)', () => {
  const handlers = () => ({ edit: vi.fn(), remove: vi.fn(), moveTo: vi.fn() });
  const labels = (entries: { label: string }[]) => entries.map((e) => e.label);

  it('lieu : Modifier, Supprimer, Déplacer vers, Voir dans Google Maps, chacun avec son icône', () => {
    const h = handlers();
    const step = makeStep();
    const entries = stepMenuEntries(step, days, true, h);
    expect(labels(entries)).toEqual([
      'Modifier',
      'Supprimer',
      'Déplacer vers',
      'Voir dans Google Maps',
    ]);
    expect(entries.every((e) => e.icon)).toBe(true);
    const [edit, remove, move, maps] = entries;
    if (edit?.kind === 'action') edit.run();
    expect(h.edit).toHaveBeenCalledWith(step);
    if (remove?.kind === 'action') remove.run();
    expect(h.remove).toHaveBeenCalledWith(step);
    expect(remove).toMatchObject({ danger: true });
    expect(move?.kind === 'submenu' && move.items.map((i) => i.label)).toEqual(['Idées', 'J2']);
    if (move?.kind === 'submenu') move.items[0]!.run();
    expect(h.moveTo).toHaveBeenCalledWith(step, null);
    expect(maps).toMatchObject({
      kind: 'link',
      href: 'https://www.google.com/maps/search/?api=1&query=48.8606,2.3376',
    });
  });

  it('lecture seule : seulement Voir dans Google Maps', () => {
    expect(labels(stepMenuEntries(makeStep(), days, false, handlers()))).toEqual([
      'Voir dans Google Maps',
    ]);
  });

  it('dossier : pas de Google Maps ; rien en lecture seule', () => {
    const group = makeStep({ kind: 'group', type: null, lat: null, lng: null });
    expect(labels(stepMenuEntries(group, days, true, handlers()))).toEqual([
      'Modifier',
      'Supprimer',
      'Déplacer vers',
    ]);
    expect(stepMenuEntries(group, days, false, handlers())).toEqual([]);
  });
});

describe('moveTargets (destinations de « Déplacer vers »)', () => {
  it('étape de J1 : les idées puis les autres jours, avec leur date, sans J1', () => {
    expect(moveTargets(makeStep({ dayId: 'd1' }), days)).toEqual([
      { dayId: null, label: 'Idées', hint: null },
      { dayId: 'd2', label: 'J2', hint: 'sam. 11 juil.' },
    ]);
  });

  it('idée : tous les jours, pas les idées', () => {
    expect(moveTargets(makeStep({ dayId: null }), days).map((t) => t.label)).toEqual(['J1', 'J2']);
  });

  it('étape d’un dossier : son jour n’est pas proposé non plus', () => {
    const child = makeStep({ dayId: 'd2', parentId: 'g1' });
    expect(moveTargets(child, days).map((t) => t.label)).toEqual(['Idées', 'J1']);
  });
});

describe('googleMapsUrl', () => {
  it('ouvre le point GPS dans Google Maps', () => {
    expect(googleMapsUrl(48.8606, 2.3376)).toBe(
      'https://www.google.com/maps/search/?api=1&query=48.8606,2.3376',
    );
  });
});

describe('moveToEndOp (opération de lot du déplacement)', () => {
  const steps = [
    makeStep({ id: 'a', dayId: 'd1', position: 'a1' }),
    makeStep({ id: 'b', dayId: 'd2', position: 'a1' }),
    makeStep({ id: 'c', dayId: 'd2', position: 'a2' }),
    makeStep({ id: 'g', dayId: 'd2', kind: 'group', type: null, position: 'a3' }),
    makeStep({ id: 'gc', dayId: 'd2', parentId: 'g', position: 'a9' }),
  ];

  it('place l’étape à la fin des racines du jour visé, hors de tout dossier', () => {
    const op = moveToEndOp(steps[0]!, 'd2', steps);
    expect(op).toMatchObject({ kind: 'step', id: 'a', patch: { dayId: 'd2', parentId: null } });
    // Après le dossier (dernière racine), sans tenir compte de ses enfants.
    expect(op.kind === 'step' && op.patch.position! > 'a3').toBe(true);
  });

  it('vers les idées : dayId null', () => {
    const op = moveToEndOp(makeStep({ id: 'gc', dayId: 'd2', parentId: 'g' }), null, steps);
    expect(op).toMatchObject({ patch: { dayId: null, parentId: null } });
  });

  it('un dossier se déplace comme une étape (ses étapes le suivent côté API)', () => {
    const op = moveToEndOp(steps[3]!, 'd1', steps);
    expect(op).toMatchObject({ id: 'g', patch: { dayId: 'd1', parentId: null } });
    expect(op.kind === 'step' && op.patch.position! > 'a1').toBe(true);
  });
});
