import { describe, expect, it } from 'vitest';
import { loginUrl, safeNext } from './next';

describe('page de retour après connexion', () => {
  it('garde un chemin interne', () => {
    expect(safeNext('/trips/abc?x=1')).toBe('/trips/abc?x=1');
    expect(safeNext('/invitation/jeton')).toBe('/invitation/jeton');
  });

  it('refuse une adresse externe, vide ou la page de connexion elle-même', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext('https://pirate.example')).toBe('/');
    expect(safeNext('//pirate.example')).toBe('/');
    expect(safeNext('/\\pirate.example')).toBe('/');
    expect(safeNext('/connexion?suite=/x')).toBe('/');
  });

  it('URL de connexion avec la page de retour', () => {
    expect(loginUrl('/trips/abc?x=1')).toBe('/connexion?suite=%2Ftrips%2Fabc%3Fx%3D1');
    expect(loginUrl('/')).toBe('/connexion');
  });
});
