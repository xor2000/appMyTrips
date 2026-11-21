import type {
  LayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
  TransformStyleFunction,
} from 'maplibre-gl';

/** Fond de carte vectoriel OpenFreeMap (sans clé ; service fourni sans garantie). */
export const PLAN_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Fond topographique OpenTopoMap (tuiles raster), utile pour les randonnées. */
export const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Carte : © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · Données : © <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
};

/** Imagerie satellite Esri World Imagery (tuiles raster sans clé, attribution obligatoire). */
const SATELLITE_SOURCE: RasterSourceSpecification = {
  type: 'raster',
  tiles: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ],
  tileSize: 256,
  maxzoom: 19,
  attribution:
    'Imagerie : © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics et la communauté des utilisateurs SIG',
};

export type MapStyleId = 'plan' | 'topo' | 'satellite';

/** Le satellite part du style Liberty (libellés et routes), transformé par `transformFor`. */
export function styleFor(id: MapStyleId): string | StyleSpecification {
  return id === 'topo' ? TOPO_STYLE : PLAN_STYLE_URL;
}

/** Transformation de style à passer à la carte (création et chaque `setStyle`). */
export function transformFor(id: MapStyleId): TransformStyleFunction {
  return id === 'satellite'
    ? (previous, next) => toHybrid(guardMissingNumbers(previous, next))
    : guardMissingNumbers;
}

/** Couches du plan gardées par-dessus l'image : routes (sans contours ni tunnels) et frontières. */
function keepOnSatellite(layer: LayerSpecification): boolean {
  if (layer.type === 'symbol') return true;
  if (layer.type !== 'line') return false;
  const sourceLayer = layer['source-layer'];
  if (sourceLayer === 'boundary') return true;
  return (
    sourceLayer === 'transportation' &&
    !layer.id.startsWith('tunnel_') &&
    !layer.id.includes('casing') &&
    !layer.id.includes('hatching')
  );
}

/** Libellés lisibles sur une photo : texte clair sur halo sombre (pas les panneaux de route). */
function adaptToSatellite(layer: LayerSpecification): LayerSpecification {
  if (layer.type === 'line') {
    return { ...layer, paint: { ...layer.paint, 'line-opacity': 0.6 } };
  }
  if (layer.type === 'symbol' && !layer.id.includes('shield')) {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.75)',
      },
    };
  }
  return layer;
}

/**
 * Vue hybride à partir du style Liberty : imagerie Esri en dessous, puis les routes, frontières
 * et libellés du plan (aplats, bâtiments et relief retirés). Sprite et polices sont conservés ;
 * les sources qui ne servent plus sont retirées.
 */
export function toHybrid(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.filter(keepOnSatellite).map(adaptToSatellite);
  const used = new Set(layers.map((layer) => ('source' in layer ? layer.source : undefined)));
  const sources = Object.fromEntries(Object.entries(style.sources).filter(([id]) => used.has(id)));
  return {
    ...style,
    sources: { satellite: { ...SATELLITE_SOURCE }, ...sources },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }, ...layers],
  };
}

const NUMERIC_COMPARISONS = new Set(['<', '<=', '>', '>=']);

/** `["get", "propriété"]` : nom de la propriété lue, sinon null. */
function readProperty(value: unknown): string | null {
  return Array.isArray(value) &&
    value.length === 2 &&
    value[0] === 'get' &&
    typeof value[1] === 'string'
    ? value[1]
    : null;
}

/**
 * Protège les comparaisons numériques situées à la racine du filtre ou dans des `all` imbriqués :
 * là seulement, un `false` local rend tout le filtre faux, comme l'erreur qu'il remplace. Sous `!`
 * ou `any`, le résultat changerait : on n'y touche pas.
 */
function guardExpression(expression: unknown): unknown {
  if (!Array.isArray(expression)) return expression;
  const [op, left, right] = expression;
  if (op === 'all') return [op, ...expression.slice(1).map(guardExpression)];
  if (expression.length === 3 && typeof op === 'string' && NUMERIC_COMPARISONS.has(op)) {
    const property =
      typeof right === 'number'
        ? readProperty(left)
        : typeof left === 'number'
          ? readProperty(right)
          : null;
    if (property) return ['all', ['has', property], expression];
  }
  return expression;
}

/**
 * Transformation de style (`transformStyle` de MapLibre). Le style Liberty d'OpenFreeMap compare
 * des propriétés souvent absentes à un nombre (`["<=", ["get", "ref_length"], 6]` des panneaux de
 * route) : MapLibre évalue alors `null`, consigne un avertissement par tuile et retombe sur
 * `false` pour tout le filtre. On ajoute `["has", …]` devant la comparaison (`all` s'arrête au
 * premier faux) : même résultat, sans avertissement.
 */
export function guardMissingNumbers(
  _previous: StyleSpecification | undefined,
  next: StyleSpecification,
): StyleSpecification {
  return {
    ...next,
    layers: next.layers.map((layer) =>
      'filter' in layer && layer.filter
        ? ({ ...layer, filter: guardExpression(layer.filter) } as typeof layer)
        : layer,
    ),
  };
}

/** Image transparente de 1 × 1 px. */
const BLANK_IMAGE = { width: 1, height: 1, data: new Uint8Array(4) };

/**
 * Résolveur d'images manquantes (`setMissingStyleImageResolver`). Le sprite d'OpenFreeMap n'a pas
 * d'icône pour certaines classes de lieux (`sports_centre`, `gate`…) : on enregistre une image
 * transparente, comme MapLibre le ferait sans icône, mais sans avertissement dans la console.
 */
export function missingImageResolver(map: {
  hasImage(id: string): boolean;
  addImage(id: string, image: typeof BLANK_IMAGE): unknown;
}) {
  return (id: string) => {
    if (!map.hasImage(id)) map.addImage(id, BLANK_IMAGE);
  };
}
