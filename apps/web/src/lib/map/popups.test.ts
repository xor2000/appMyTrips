import { describe, expect, it, vi } from 'vitest';
import { days, makeLeg, makePoi, makeStep } from '#lib/test/fixtures.ts';
import { legPopupContent, poiPopupContent, stepPopupContent } from './popups';

const labels = (c: { actions: { label: string }[] }) => c.actions.map((a) => a.label);

describe('stepPopupContent (comme buildPoiPopup de la référence)', () => {
  const handlers = { edit: vi.fn(), remove: vi.fn() };

  it('étape d’un jour : « type · jour », nom, notes, couleur, Modifier et Supprimer', () => {
    const c = stepPopupContent(
      makeStep({ dayId: 'd2', notes: 'Billet coupe-file' }),
      days,
      true,
      handlers,
    );
    expect(c).toMatchObject({
      kind: 'step',
      category: 'Musée · J2',
      title: 'Musée du Louvre',
      notes: 'Billet coupe-file',
      color: '--type-museum',
      meta: [],
      chip: null,
    });
    expect(labels(c)).toEqual(['Modifier', 'Supprimer']);
    c.actions[0]!.run();
    expect(handlers.edit).toHaveBeenCalledWith('s1');
    c.actions[1]!.run();
    expect(handlers.remove).toHaveBeenCalledWith('s1');
  });

  it('idée : « Idée » ; sans type : « Lieu » et couleur neutre ; jour inconnu : type seul', () => {
    expect(stepPopupContent(makeStep({ dayId: null }), days, true, handlers).category).toBe(
      'Musée · Idée',
    );
    const untyped = stepPopupContent(makeStep({ type: null }), days, true, handlers);
    expect(untyped.category).toBe('Lieu · J1');
    expect(untyped.color).toBe('--type-transport');
    expect(stepPopupContent(makeStep({ dayId: 'x' }), days, true, handlers).category).toBe('Musée');
  });

  it('lecture seule : aucune action', () => {
    expect(stepPopupContent(makeStep(), days, false, handlers).actions).toEqual([]);
  });
});

describe('legPopupContent (comme buildRoutePopup de la référence)', () => {
  const handlers = { edit: vi.fn(), remove: vi.fn() };
  const names = { from: 'Musée du Louvre', to: 'Musée d’Orsay' };

  it('« mode · jour », départ → arrivée, distance · durée, Modifier et Supprimer', () => {
    const c = legPopupContent(makeLeg(), names, 'J1', true, handlers);
    expect(c).toMatchObject({
      kind: 'leg',
      category: 'Voiture · J1',
      title: 'Musée du Louvre → Musée d’Orsay',
      meta: ['72 km', '1 h 15'],
      color: '--type-transport',
      chip: null,
      notes: '',
    });
    expect(labels(c)).toEqual(['Modifier', 'Supprimer']);
    c.actions[1]!.run();
    expect(handlers.remove).toHaveBeenCalledWith('l1');
  });

  it('estimé ou forcé en pastille (le « Tracé direct » de la référence) ; lignes en notes', () => {
    const c = legPopupContent(
      makeLeg({ mode: 'train', distanceM: null, durationSource: 'estimate', summary: 'TER 17611' }),
      names,
      null,
      true,
      handlers,
    );
    expect(c.category).toBe('Train');
    expect(c.meta).toEqual(['1 h 15']);
    expect(c.chip).toEqual({ label: 'estimé', check: false });
    expect(c.notes).toBe('TER 17611');
  });

  it('lecture seule : aucune action', () => {
    expect(legPopupContent(makeLeg(), names, 'J1', false, handlers).actions).toEqual([]);
  });
});

describe('poiPopupContent (comme buildDiscoverPopup de la référence)', () => {
  const handlers = { addToDay: vi.fn(), addToIdeas: vi.fn(), remove: vi.fn() };

  it('pas encore ajouté : « type · OpenStreetMap », nom, adresse, Ajouter au jour et aux idées', () => {
    const c = poiPopupContent(
      makePoi({ address: '107 rue de Rivoli' }),
      false,
      'J2',
      true,
      handlers,
    );
    expect(c).toMatchObject({
      kind: 'poi',
      category: 'Musée · OpenStreetMap',
      title: 'Musée des Arts décoratifs',
      notes: '107 rue de Rivoli',
      color: '--type-museum',
      chip: null,
    });
    expect(labels(c)).toEqual(['Ajouter à J2', 'Ajouter aux idées']);
    expect(c.actions.map((a) => a.primary ?? false)).toEqual([true, false]);
    c.actions[0]!.run();
    expect(handlers.addToDay).toHaveBeenCalled();
    c.actions[1]!.run();
    expect(handlers.addToIdeas).toHaveBeenCalled();
  });

  it('vue d’ensemble (sans jour) : seulement « Ajouter aux idées », en principal', () => {
    const c = poiPopupContent(makePoi(), false, null, true, handlers);
    expect(labels(c)).toEqual(['Ajouter aux idées']);
    expect(c.actions[0]!.primary).toBe(true);
  });

  it('déjà ajouté : pastille cochée « Déjà ajouté » et « Supprimer »', () => {
    const c = poiPopupContent(makePoi(), true, 'J2', true, handlers);
    expect(c.chip).toEqual({ label: 'Déjà ajouté', check: true });
    expect(labels(c)).toEqual(['Supprimer']);
    c.actions[0]!.run();
    expect(handlers.remove).toHaveBeenCalled();
  });

  it('source Geoapify ; lecture seule : pastille gardée, aucune action', () => {
    const c = poiPopupContent(makePoi({ source: 'geoapify' }), true, 'J2', false, handlers);
    expect(c.category).toBe('Musée · Geoapify · OpenStreetMap');
    expect(c.chip?.label).toBe('Déjà ajouté');
    expect(c.actions).toEqual([]);
  });
});
