// Serveur Photon factice pour les e2e : réponses déterministes, sans dépendre du service réel.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PHOTON_PORT ?? 8798);

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

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/health') return res.end('{"ok":true}');
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
}).listen(PORT, () => console.log(`Photon factice sur http://localhost:${PORT}`));
