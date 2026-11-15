import { describe, expect, it } from 'vitest';
import { Email, TripId } from './index';

describe('schémas de base', () => {
  it('accepte un identifiant de voyage UUID', () => {
    const id = '3f0fa7bf-e95b-4fee-ab08-b30a6385734f';
    expect(TripId.parse(id)).toBe(id);
  });

  it('refuse un identifiant de voyage qui n’est pas un UUID', () => {
    expect(TripId.safeParse('voyage-1').success).toBe(false);
    expect(TripId.safeParse('').success).toBe(false);
  });

  it('normalise un e-mail en minuscules et sans espaces', () => {
    expect(Email.parse('  Alice@Example.TEST ')).toBe('alice@example.test');
  });

  it('refuse un e-mail invalide', () => {
    expect(Email.safeParse('alice').success).toBe(false);
    expect(Email.safeParse('').success).toBe(false);
  });
});
