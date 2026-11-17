import type { StyleSpecification } from 'maplibre-gl';

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

export type MapStyleId = 'plan' | 'topo';

export function styleFor(id: MapStyleId): string | StyleSpecification {
  return id === 'plan' ? PLAN_STYLE_URL : TOPO_STYLE;
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
