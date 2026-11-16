import { describe, expect, it } from 'vitest';
import { isGpxFile, readGpxFile } from './import.ts';

const GPX = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Semnoz</name><trkseg>
<trkpt lat="45.80" lon="6.10"><ele>600</ele></trkpt>
<trkpt lat="45.81" lon="6.11"><ele>700</ele></trkpt>
</trkseg></trk></gpx>`;

const file = (content: string, name = 'semnoz.gpx', type = 'application/gpx+xml') =>
  new File([content], name, { type });

describe('import d’un fichier GPX', () => {
  it('reconnaît un fichier GPX par son extension ou son type', () => {
    expect(isGpxFile(file('', 'trace.GPX', ''))).toBe(true);
    expect(isGpxFile(file('', 'trace.xml', 'application/gpx+xml'))).toBe(true);
    expect(isGpxFile(file('', 'photo.jpg', 'image/jpeg'))).toBe(false);
  });

  it('lit nom, statistiques et tracé ; nom du fichier à défaut', async () => {
    const read = await readGpxFile(file(GPX));
    expect(read.name).toBe('Semnoz');
    expect(read.gpx.track).toHaveLength(2);
    expect(read.gpx.stats.distanceM).toBeGreaterThan(1000);
    const unnamed = await readGpxFile(
      file(GPX.replace('<name>Semnoz</name>', ''), 'Tour du lac.gpx'),
    );
    expect(unnamed.name).toBe('Tour du lac');
  });

  it('refuse un fichier trop gros ou illisible, avec un message clair', async () => {
    const big = file('x');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await expect(readGpxFile(big)).rejects.toThrow('Fichier GPX trop gros (10 Mo au plus).');
    await expect(readGpxFile(file('<gpx><trk>'))).rejects.toThrow('Fichier GPX illisible');
  });
});
