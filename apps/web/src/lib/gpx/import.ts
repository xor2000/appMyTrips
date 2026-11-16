import { GPX_MAX_BYTES, GpxError, prepareGpx, type GpxData } from '@mytrips/core';

/** Fichier GPX, d'après son extension ou son type. */
export function isGpxFile(file: File): boolean {
  return /\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml';
}

/**
 * Lit un fichier GPX dans le navigateur : nom (trace, sinon nom du fichier), statistiques et tracé
 * simplifié. L'analyse se fait ici : le Worker (10 ms de CPU par requête) ne reçoit que le résultat.
 */
export async function readGpxFile(file: File): Promise<{ name: string; gpx: GpxData }> {
  if (file.size > GPX_MAX_BYTES) throw new Error('Fichier GPX trop gros (10 Mo au plus).');
  const text = await file.text();
  try {
    const { name, gpx } = prepareGpx(text);
    return { name: name ?? file.name.replace(/\.gpx$/i, ''), gpx };
  } catch (e) {
    if (e instanceof GpxError) throw new Error(e.message, { cause: e });
    throw e;
  }
}
