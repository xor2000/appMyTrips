import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import {
  guardMissingNumbers,
  missingImageResolver,
  PLAN_STYLE_URL,
  styleFor,
  toHybrid,
  transformFor,
  TOPO_STYLE,
} from './styles';

function styleWith(...filters: unknown[]): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      { id: 'fond', type: 'background' },
      ...filters.map((filter, i) => ({ id: `c${i}`, type: 'line', source: 's', filter })),
    ],
  } as StyleSpecification;
}

const filterOf = (style: StyleSpecification, index: number) =>
  (style.layers[index] as { filter?: unknown }).filter;

describe('guardMissingNumbers', () => {
  it('ne compare une propriété à un nombre que si elle existe (panneaux de route de Liberty)', () => {
    const style = styleWith([
      'all',
      ['<=', ['get', 'ref_length'], 6],
      ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ]);
    expect(filterOf(guardMissingNumbers(undefined, style), 1)).toEqual([
      'all',
      ['all', ['has', 'ref_length'], ['<=', ['get', 'ref_length'], 6]],
      ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ]);
  });

  it('protège aussi un filtre de premier niveau et le nombre placé à gauche', () => {
    const style = styleWith(['>', 3, ['get', 'rank']], ['<', ['get', 'n'], 2]);
    const fixed = guardMissingNumbers(undefined, style);
    expect(filterOf(fixed, 1)).toEqual(['all', ['has', 'rank'], ['>', 3, ['get', 'rank']]]);
    expect(filterOf(fixed, 2)).toEqual(['all', ['has', 'n'], ['<', ['get', 'n'], 2]]);
  });

  it('laisse intacts les autres filtres et les anciens filtres sans expression', () => {
    const legacy = ['<=', 'ref_length', 6];
    const equality = ['==', ['get', 'class'], 'motorway'];
    const twoProps = ['<', ['get', 'a'], ['get', 'b']];
    const style = styleWith(legacy, equality, twoProps);
    const fixed = guardMissingNumbers(undefined, style);
    expect(filterOf(fixed, 1)).toEqual(legacy);
    expect(filterOf(fixed, 2)).toEqual(equality);
    expect(filterOf(fixed, 3)).toEqual(twoProps);
    expect(fixed.layers[0]).toEqual({ id: 'fond', type: 'background' });
  });

  it('ne touche pas une comparaison sous `!` ou `any`, où l’erreur rend tout le filtre faux', () => {
    const negated = ['!', ['<', ['get', 'rank'], 3]];
    const either = ['any', ['<', ['get', 'rank'], 3], ['==', ['get', 'class'], 'park']];
    const fixed = guardMissingNumbers(undefined, styleWith(negated, either));
    expect(filterOf(fixed, 1)).toEqual(negated);
    expect(filterOf(fixed, 2)).toEqual(either);
  });

  it('ne modifie pas le style reçu', () => {
    const style = styleWith(['<=', ['get', 'ref_length'], 6]);
    const before = structuredClone(style);
    guardMissingNumbers(undefined, style);
    expect(style).toEqual(before);
  });
});

describe('missingImageResolver', () => {
  function fakeMap() {
    const images = new Map<string, { width: number; height: number; data: Uint8Array }>();
    return {
      images,
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: { width: number; height: number; data: Uint8Array }) => {
        images.set(id, image);
      },
    };
  }

  it('remplace une icône absente du sprite par une image transparente de 1 × 1 px', () => {
    const map = fakeMap();
    void missingImageResolver(map)('sports_centre');
    const image = map.images.get('sports_centre');
    expect(image?.width).toBe(1);
    expect(image?.height).toBe(1);
    expect([...(image?.data ?? [])]).toEqual([0, 0, 0, 0]);
  });

  it('n’ajoute pas deux fois la même icône', () => {
    const map = fakeMap();
    const resolve = missingImageResolver(map);
    void resolve('gate');
    const first = map.images.get('gate');
    void resolve('gate');
    expect(map.images.get('gate')).toBe(first);
    expect(map.images.size).toBe(1);
  });
});

/** Extrait du style Liberty d'OpenFreeMap : une couche de chaque famille. */
function liberty(): StyleSpecification {
  return {
    version: 8,
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      ne2_shaded: { type: 'raster', url: 'https://tiles.openfreemap.org/natural_earth' },
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'background', type: 'background' },
      { id: 'natural_earth', type: 'raster', source: 'ne2_shaded' },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building' },
      { id: 'waterway_river', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway' },
      {
        id: 'road_motorway_casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
      },
      {
        id: 'road_motorway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['<=', ['get', 'ref_length'], 6],
        paint: { 'line-color': '#fc8', 'line-width': 2 },
      },
      {
        id: 'tunnel_motorway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
      },
      {
        id: 'road_major_rail_hatching',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
      },
      { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' },
      {
        id: 'label_city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        layout: { 'text-field': '{name}' },
        paint: { 'text-color': '#333', 'text-halo-color': '#fff' },
      },
      {
        id: 'highway-shield-non-us',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        layout: { 'text-field': '{ref}', 'icon-image': 'road_2' },
      },
    ],
  } as StyleSpecification;
}

const ids = (style: StyleSpecification) => style.layers.map((layer) => layer.id);
const layer = (style: StyleSpecification, id: string) =>
  style.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> } | undefined;

describe('toHybrid (fond satellite)', () => {
  it('met l’imagerie satellite d’Esri sous les routes, frontières et libellés du plan', () => {
    const hybrid = toHybrid(liberty());
    expect(ids(hybrid)).toEqual([
      'satellite',
      'road_motorway',
      'boundary_2',
      'label_city',
      'highway-shield-non-us',
    ]);
    expect(hybrid.layers[0]).toMatchObject({ type: 'raster', source: 'satellite' });
    const source = hybrid.sources.satellite as {
      type: string;
      tiles: string[];
      attribution: string;
    };
    expect(source.type).toBe('raster');
    expect(source.tiles).toEqual([
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ]);
    expect(source.attribution).toContain('Esri');
  });

  it('garde la source vectorielle, le sprite et les polices, sans la source inutilisée', () => {
    const hybrid = toHybrid(liberty());
    expect(Object.keys(hybrid.sources).sort()).toEqual(['openmaptiles', 'satellite']);
    expect(hybrid.sprite).toBe(liberty().sprite);
    expect(hybrid.glyphs).toBe(liberty().glyphs);
  });

  it('écrit les libellés en blanc sur halo sombre, sauf le texte des panneaux de route', () => {
    const hybrid = toHybrid(liberty());
    expect(layer(hybrid, 'label_city')?.paint).toMatchObject({
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0, 0, 0, 0.75)',
    });
    expect(layer(hybrid, 'highway-shield-non-us')?.paint?.['text-color']).toBeUndefined();
  });

  it('rend les routes translucides pour laisser voir l’image', () => {
    const paint = layer(toHybrid(liberty()), 'road_motorway')?.paint;
    expect(paint).toMatchObject({ 'line-color': '#fc8', 'line-width': 2, 'line-opacity': 0.6 });
  });

  it('ne modifie pas le style reçu', () => {
    const style = liberty();
    const before = structuredClone(style);
    toHybrid(style);
    expect(style).toEqual(before);
  });
});

describe('styleFor et transformFor', () => {
  it('le satellite part du style Liberty, transformé en vue hybride protégée', () => {
    expect(styleFor('satellite')).toBe(PLAN_STYLE_URL);
    const hybrid = transformFor('satellite')(undefined, liberty());
    expect(ids(hybrid)[0]).toBe('satellite');
    expect((hybrid.layers[1] as { filter?: unknown }).filter).toEqual([
      'all',
      ['has', 'ref_length'],
      ['<=', ['get', 'ref_length'], 6],
    ]);
  });

  it('plan et topo gardent leur style, avec la seule protection des comparaisons', () => {
    expect(styleFor('plan')).toBe(PLAN_STYLE_URL);
    expect(styleFor('topo')).toBe(TOPO_STYLE);
    expect(transformFor('plan')).toBe(guardMissingNumbers);
    expect(transformFor('topo')).toBe(guardMissingNumbers);
  });
});
