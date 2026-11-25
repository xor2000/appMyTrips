// Services externes factices pour les e2e (Photon, Overpass, OSRM, Transitous) :
// réponses déterministes, sans dépendre des services réels. Ils sont appelés par le Worker, pas
// par le navigateur.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_SERVICES_PORT ?? 8798);

const PLACES = [
  {
    name: 'Musée du Louvre',
    key: 'tourism',
    value: 'museum',
    lng: 2.3376,
    lat: 48.8606,
    city: 'Paris',
  },
  {
    name: 'Musée d’Orsay',
    key: 'tourism',
    value: 'museum',
    lng: 2.3266,
    lat: 48.86,
    city: 'Paris',
  },
  {
    name: 'Tour Eiffel',
    key: 'tourism',
    value: 'attraction',
    lng: 2.2945,
    lat: 48.8584,
    city: 'Paris',
  },
  {
    name: 'Notre-Dame de Paris',
    key: 'historic',
    value: 'cathedral',
    lng: 2.3499,
    lat: 48.853,
    city: 'Paris',
  },
  {
    name: 'Le Comptoir',
    key: 'amenity',
    value: 'restaurant',
    lng: 2.339,
    lat: 48.852,
    city: 'Paris',
  },
  {
    name: 'Hôtel des Arts',
    key: 'tourism',
    value: 'hotel',
    lng: 2.343,
    lat: 48.865,
    city: 'Paris',
  },
  {
    name: 'Aéroport de Marseille',
    key: 'aeroway',
    value: 'aerodrome',
    lng: 5.2214,
    lat: 43.4393,
    city: 'Marignane',
  },
];

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function feature(p, i) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: {
      osm_type: 'N',
      osm_id: 1000 + i,
      osm_key: p.key,
      osm_value: p.value,
      name: p.name,
      city: p.city,
      country: 'France',
    },
  };
}

// Lieux Overpass, autour du Louvre. Le Louvre a la même référence OSM (N1000) que dans Photon :
// ajouté par la recherche, il apparaît « déjà ajouté » dans la découverte.
const OVERPASS_ELEMENTS = [
  {
    type: 'node',
    id: 1000,
    lat: 48.8606,
    lon: 2.3376,
    tags: { name: 'Musée du Louvre', tourism: 'museum', wikidata: 'Q19675' },
  },
  {
    type: 'node',
    id: 2001,
    lat: 48.863,
    lon: 2.333,
    tags: {
      name: 'Musée des Arts décoratifs',
      tourism: 'museum',
      opening_hours: 'Tu-Su 11:00-18:00',
      website: 'https://madparis.fr',
      'addr:housenumber': '107',
      'addr:street': 'Rue de Rivoli',
      'addr:city': 'Paris',
    },
  },
  {
    type: 'way',
    id: 2002,
    center: { lat: 48.8638, lon: 2.3226 },
    tags: { name: 'Musée de l’Orangerie', tourism: 'museum' },
  },
  {
    type: 'node',
    id: 2003,
    lat: 48.8622,
    lon: 2.3405,
    tags: { name: 'Café Kitsuné', amenity: 'cafe' },
  },
];

/** Réponse Overpass : éléments dont les tags correspondent à l'une des règles de la requête. */
function overpass(query) {
  const rules = [...query.matchAll(/nwr\["([^"]+)"~"\^\(([^)]+)\)\$"\]/g)].map((m) => ({
    key: m[1],
    values: m[2].split('|'),
  }));
  const elements = OVERPASS_ELEMENTS.filter((el) =>
    rules.some((r) => r.values.includes(el.tags[r.key])),
  );
  return { elements };
}

function readBody(req) {
  return new Promise((done) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => done(body));
  });
}

/** Polyligne encodée (algorithme de Google, précision 5) de points [lat, lng]. */
function encodePolyline(points) {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const encode = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    encode(la - prevLat);
    encode(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/health') return res.end('{"ok":true}');
  // OSRM (routing.openstreetmap.de) : itinéraire fixe de 12,3 km en 25 min, tracé en trois points
  // (polyligne).
  const osrm = /^\/osrm\/routed-(car|bike|foot)\/route\/v1\/driving\/([^/]+)$/.exec(url.pathname);
  if (osrm && req.method === 'GET') {
    const [[lng1, lat1], [lng2, lat2]] = osrm[2].split(';').map((p) => p.split(',').map(Number));
    return res.end(
      JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 12_345,
            duration: 1_500,
            // `geometries=polyline` : polyligne de précision 5, comme le vrai service.
            geometry: encodePolyline([
              [lat1, lng1],
              [(lat1 + lat2) / 2 + 0.002, (lng1 + lng2) / 2],
              [lat2, lng2],
            ]),
          },
        ],
        waypoints: [],
      }),
    );
  }
  // Transitous : aucun itinéraire (la saisie manuelle prend le relais).
  if (url.pathname === '/transitous/api/v5/plan') {
    return res.end(JSON.stringify({ itineraries: [], direct: [] }));
  }
  if (url.pathname === '/overpass/api/interpreter') {
    const query = new URLSearchParams(await readBody(req)).get('data') ?? '';
    return res.end(JSON.stringify(overpass(query)));
  }
  if (url.pathname === '/api/' || url.pathname === '/api') {
    const q = norm(url.searchParams.get('q') ?? '');
    const found = PLACES.map((p, i) => [p, i]).filter(([p]) => norm(p.name).includes(q));
    return res.end(
      JSON.stringify({ type: 'FeatureCollection', features: found.map(([p, i]) => feature(p, i)) }),
    );
  }
  if (url.pathname === '/reverse') {
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lon'));
    const p = { name: 'Lieu sur la carte', key: 'place', value: 'square', lat, lng, city: 'Paris' };
    return res.end(JSON.stringify({ type: 'FeatureCollection', features: [feature(p, 99)] }));
  }
  res.statusCode = 404;
  res.end('{}');
}).listen(PORT, () => console.log(`Services factices sur http://localhost:${PORT}`));
