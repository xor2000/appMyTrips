import { describe, expect, it } from 'vitest';
import { days, makeStep } from '#lib/test/fixtures.ts';
import { stepPopupInfo } from './stepPopup';

describe('stepPopupInfo', () => {
  it('étape d’un jour : type, jour (J1, J2…), nom, notes et couleur du type', () => {
    const info = stepPopupInfo(makeStep({ dayId: 'd2', notes: 'Billet coupe-file' }), days);
    expect(info).toEqual({
      stepId: 's1',
      category: 'Musée',
      context: 'J2',
      name: 'Musée du Louvre',
      notes: 'Billet coupe-file',
      color: '--type-museum',
    });
  });

  it('idée (sans jour) : « Idée » à la place du jour', () => {
    expect(stepPopupInfo(makeStep({ dayId: null }), days).context).toBe('Idée');
  });

  it('sans type : « Lieu », couleur neutre ; notes vides gardées vides', () => {
    const info = stepPopupInfo(makeStep({ type: null, notes: '' }), days);
    expect(info.category).toBe('Lieu');
    expect(info.color).toBe('--type-transport');
    expect(info.notes).toBe('');
  });

  it('jour introuvable : pas de libellé de jour', () => {
    expect(stepPopupInfo(makeStep({ dayId: 'inconnu' }), days).context).toBe('');
  });
});
