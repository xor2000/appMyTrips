import { describe, expect, it } from 'vitest';
import { TripPatch } from '../trip/schemas';
import {
  ILLUSTRATIONS,
  IllustrationId,
  illustrationLabel,
  parseIllustration,
  suggestIllustration,
} from './illustration';

describe('ILLUSTRATIONS', () => {
  it('propose 24 illustrations aux identifiants uniques, chacune avec un libellé', () => {
    const ids = ILLUSTRATIONS.map((i) => i.id);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    for (const illustration of ILLUSTRATIONS) {
      expect(illustration.label.trim()).not.toBe('');
      expect(IllustrationId.safeParse(illustration.id).success).toBe(true);
    }
  });

  it('commence par la randonnée et finit par le voyage générique', () => {
    expect(ILLUSTRATIONS[0]?.id).toBe('randonnee');
    expect(ILLUSTRATIONS.at(-1)?.id).toBe('voyage');
  });

  it('donne le libellé français d’une illustration', () => {
    expect(illustrationLabel('camping-car')).toBe('Camping-car');
    expect(illustrationLabel('roadtrip')).toBe('Roadtrip en voiture');
  });
});

describe('parseIllustration', () => {
  it('garde un identifiant connu et lit tout le reste comme null', () => {
    expect(parseIllustration('van')).toBe('van');
    expect(parseIllustration('licorne')).toBeNull();
    expect(parseIllustration(null)).toBeNull();
    expect(parseIllustration(undefined)).toBeNull();
    expect(parseIllustration({ url: 'https://upload.wikimedia.org/x.jpg' })).toBeNull();
  });
});

describe('suggestIllustration', () => {
  it('reconnaît le type de voyage dans le nom, sans tenir compte des accents ni de la casse', () => {
    expect(suggestIllustration('Randonnée GR20', [])).toBe('randonnee');
    expect(suggestIllustration('Road trip en Écosse', [])).toBe('roadtrip');
    expect(suggestIllustration('CAMPING-CAR Bretagne', [])).toBe('camping-car');
    expect(suggestIllustration('Ski à Tignes', [])).toBe('ski');
    expect(suggestIllustration('Vanlife au Portugal', [])).toBe('van');
    expect(suggestIllustration('Week-end à Paris', [])).toBe('ville');
    expect(suggestIllustration('Croisière en Méditerranée', [])).toBe('croisiere');
    expect(suggestIllustration('Vacances à la plage', [])).toBe('plage');
  });

  it('préfère le moyen de transport le plus précis', () => {
    // « camping-car » contient « camping » ; « road trip en van » est un voyage en van.
    expect(suggestIllustration('Camping-car dans les Alpes', [])).toBe('camping-car');
    expect(suggestIllustration('Road trip en van', [])).toBe('van');
    expect(suggestIllustration('Ski dans les Alpes', [])).toBe('ski');
    expect(suggestIllustration('Randonnée en montagne', [])).toBe('randonnee');
  });

  it('ne confond pas un mot avec le début d’un autre', () => {
    // « vanoise » n'est pas « van », « montréal » n'est pas « mont ».
    expect(suggestIllustration('Vanoise', [])).toBe(null);
    expect(suggestIllustration('Montréal', [])).toBe(null);
  });

  it('à défaut, cherche dans les lieux les paysages, jamais les gares ni les aéroports', () => {
    expect(suggestIllustration('Été 2027', ['Plage de Pampelonne'])).toBe('plage');
    expect(suggestIllustration('Été 2027', ['Refuge du Goûter', 'Chamonix'])).toBe('randonnee');
    expect(suggestIllustration('Été 2027', ['Gare de Lyon', 'Aéroport de Nice'])).toBe(null);
    expect(suggestIllustration('Escapade', ['Musée du Louvre', 'Paris'])).toBe(null);
  });

  it('dans les lieux, des mots-clés plus stricts que pour le nom', () => {
    expect(suggestIllustration('Été 2027', ['Pic du Midi'])).toBe('montagne');
    expect(suggestIllustration('Été 2027', ['Lac d’Annecy'])).toBe('lac');
    expect(suggestIllustration('Été 2027', ['Forêt de Brocéliande'])).toBe('foret');
    // Lieux de ville ou de montagne qui ressemblent à une île, un bois ou la mer.
    expect(suggestIllustration('Été 2027', ['Île de la Cité', 'Notre-Dame'])).toBe(null);
    expect(suggestIllustration('Été 2027', ['Bois de Boulogne'])).toBe(null);
    expect(suggestIllustration('Été 2027', ['Mer de Glace'])).not.toBe('plage');
    expect(suggestIllustration('Été 2027', ['Côte de Nuits'])).toBe(null);
  });

  it('le nom passe avant les lieux', () => {
    expect(suggestIllustration('Vélo en Bretagne', ['Plage du Sillon'])).toBe('velo');
  });

  it('ne propose rien sans correspondance, ni jamais le voyage générique', () => {
    expect(suggestIllustration('Voyage test', [])).toBe(null);
    expect(suggestIllustration('', [])).toBe(null);
  });
});

describe('TripPatch.illustration', () => {
  it('accepte un identifiant connu ou null, et refuse le reste', () => {
    expect(TripPatch.parse({ illustration: 'van' })).toEqual({ illustration: 'van' });
    expect(TripPatch.parse({ illustration: null })).toEqual({ illustration: null });
    expect(TripPatch.safeParse({ illustration: 'licorne' }).success).toBe(false);
    expect(
      TripPatch.safeParse({ illustration: 'https://upload.wikimedia.org/x.jpg' }).success,
    ).toBe(false);
  });

  it('n’accepte plus de photo de couverture', () => {
    const parsed = TripPatch.safeParse({
      cover: { url: 'https://upload.wikimedia.org/x.jpg' },
    });
    // Clé inconnue ignorée : le patch reste vide, donc refusé.
    expect(parsed.success).toBe(false);
  });
});
