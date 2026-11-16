// Génère les GPX d'exemple des tests de core/gpx (valeurs connues par construction).
// Usage : node packages/core/test/fixtures/generate-gpx.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const R = 6_371_008.8;
const pt = (tag, p) =>
  `<${tag} lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${
    p.ele === undefined ? '' : `<ele>${p.ele.toFixed(1)}</ele>`
  }</${tag}>`;
const gpx = (body, name = 'Tour test') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MyTrips tests" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${name}</name></metadata>\n${body}\n</gpx>\n`;

// Boucle : cercle de 12,4 km de circonférence ; altitude 1000 → 1620 → 1000 (D+ = D− = 620 m),
// avec un bruit de ±1,5 m que le lissage doit ignorer.
const loop = [];
const radius = 12_400 / (2 * Math.PI);
const lat0 = 45.85;
const lng0 = 6.22;
const N = 400;
for (let i = 0; i < N; i++) {
  const t = (2 * Math.PI * i) / N;
  loop.push({
    lat: lat0 + ((radius / R) * Math.cos(t) * 180) / Math.PI,
    lng: lng0 + ((radius / R) * Math.sin(t) * 180) / Math.PI / Math.cos((lat0 * Math.PI) / 180),
    ele: 1000 + 310 * (1 - Math.cos(t)) + 1.5 * Math.sin(i * 2.7),
  });
}
writeFileSync(
  join(dir, 'loop.gpx'),
  gpx(
    `<trk><name>Tournette (test)</name><trkseg>\n${loop.map((p) => pt('trkpt', p)).join('\n')}\n</trkseg></trk>`,
  ),
);

// Linéaire : 100 points en ligne droite, altitude 500 → 800 (D+ 300, D− 0).
const linear = [];
for (let i = 0; i < 100; i++) {
  const f = i / 99;
  linear.push({ lat: 45.9 + 0.05 * f, lng: 6.13 + 0.07 * f, ele: 500 + 300 * f });
}
writeFileSync(
  join(dir, 'linear.gpx'),
  gpx(`<trk><trkseg>\n${linear.map((p) => pt('trkpt', p)).join('\n')}\n</trkseg></trk>`),
);

// Sans altitude.
writeFileSync(
  join(dir, 'noele.gpx'),
  gpx(
    `<trk><trkseg>\n${linear.map((p) => pt('trkpt', { lat: p.lat, lng: p.lng })).join('\n')}\n</trkseg></trk>`,
  ),
);

// Deux segments (première et seconde moitié du parcours linéaire).
writeFileSync(
  join(dir, 'multiseg.gpx'),
  gpx(
    `<trk><trkseg>\n${linear
      .slice(0, 50)
      .map((p) => pt('trkpt', p))
      .join('\n')}\n</trkseg><trkseg>\n${linear
      .slice(50)
      .map((p) => pt('trkpt', p))
      .join('\n')}\n</trkseg></trk>`,
  ),
);

// Itinéraire (rte) seulement.
writeFileSync(
  join(dir, 'route.gpx'),
  gpx(
    `<rte><name>Itinéraire</name>\n${[linear[0], linear[49], linear[99]].map((p) => pt('rtept', p)).join('\n')}\n</rte>`,
  ),
);

writeFileSync(
  join(dir, 'single.gpx'),
  gpx(`<trk><trkseg>${pt('trkpt', linear[0])}</trkseg></trk>`),
);
writeFileSync(join(dir, 'invalid.gpx'), '<gpx><trk><trkseg><trkpt lat="45" lon="6"></trkseg>');
console.log('GPX d’exemple écrits dans', dir);
