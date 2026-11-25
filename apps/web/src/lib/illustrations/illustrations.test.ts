import { readFileSync } from 'node:fs';
import { ILLUSTRATIONS } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { PICTOS } from './pictos.ts';
import { SCENES } from './scenes.ts';

// Vitest ne charge pas le CSS (`?raw` donne une chaîne vide) et, sous jsdom, `import.meta.url`
// n'est pas une adresse `file:` : lecture depuis le dossier du paquet (où tourne Vitest).
const theme = (name: string) => readFileSync(`src/lib/styles/themes/${name}.css`, 'utf8');
const pastel = theme('pastel');
const carnet = theme('carnet');

/** Variables `--illu-*` définies dans un bloc CSS. */
const definedIn = (css: string) =>
  new Set([...css.matchAll(/(--illu-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

/** Blocs d'un thème : pastel clair, pastel sombre (système et forcé), carnet. */
function themeBlocks() {
  const dark = pastel.split("[data-theme='pastel-dark']");
  const media = pastel.split('@media (prefers-color-scheme: dark)');
  return {
    'pastel clair': media[0] ?? '',
    'pastel sombre (système)': (media[1] ?? '').split("[data-theme='pastel-dark']")[0] ?? '',
    'pastel sombre': dark[1] ?? '',
    carnet,
  };
}

const all = Object.entries({ ...SCENES, ...prefixed(PICTOS) });
function prefixed(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [`picto:${k}`, v]));
}

describe('illustrations', () => {
  it('chaque illustration a sa scène et son pictogramme', () => {
    for (const { id } of ILLUSTRATIONS) {
      expect(SCENES[id], `scène ${id}`).toMatch(/^<svg[\s>]/);
      expect(PICTOS[id], `pictogramme ${id}`).toMatch(/^<svg[\s>]/);
    }
    expect(Object.keys(SCENES).sort()).toEqual(ILLUSTRATIONS.map((i) => i.id).sort());
    expect(Object.keys(PICTOS).sort()).toEqual(ILLUSTRATIONS.map((i) => i.id).sort());
  });

  it('les scènes sont en 16:10 et les pictogrammes carrés', () => {
    for (const svg of Object.values(SCENES)) expect(svg).toContain('viewBox="0 0 160 100"');
    for (const svg of Object.values(PICTOS)) expect(svg).toContain('viewBox="0 0 48 48"');
  });

  it('aucune couleur en dur : seulement les variables --illu-* du thème', () => {
    for (const [name, svg] of all) {
      expect(svg, name).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      for (const [, , value] of svg.matchAll(/\b(fill|stroke|stop-color)="([^"]*)"/g)) {
        expect(value, name).toMatch(/^(none|var\(--illu-[a-z0-9-]+\))$/);
      }
      // Pas d'identifiant : plusieurs exemplaires d'un même SVG cohabitent dans la page.
      expect(svg, name).not.toMatch(/\sid="/);
      // Insérés par `{@html}` : ni script, ni gestionnaire d'événement, ni lien, ni HTML embarqué.
      expect(svg, name).not.toMatch(/<script|\son[a-z]+\s*=|href\s*=|<foreignObject/i);
    }
  });

  it('chaque variable utilisée est définie dans chaque thème', () => {
    const used = new Set(
      all.flatMap(([, svg]) => [...svg.matchAll(/var\((--illu-[a-z0-9-]+)\)/g)].map((m) => m[1])),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const [theme, css] of Object.entries(themeBlocks())) {
      const defined = definedIn(css);
      for (const name of used) expect(defined.has(name), `${name} dans ${theme}`).toBe(true);
    }
  });
});
