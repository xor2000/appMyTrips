import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import StepPopup from './StepPopup.svelte';

const info = {
  stepId: 's1',
  category: 'Musée',
  context: 'J1',
  name: 'Musée du Louvre',
  notes: 'Billet coupe-file',
  color: '--type-museum',
};

function setup(overrides: Record<string, unknown> = {}) {
  const props = { info, canEdit: true, onEdit: vi.fn(), onDelete: vi.fn(), ...overrides };
  render(StepPopup, { props });
  return props;
}

describe('StepPopup', () => {
  it('comme la référence : « type · jour », nom en titre, notes', () => {
    setup();
    expect(screen.getByText('Musée · J1')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Musée du Louvre' })).toBeTruthy();
    expect(screen.getByText('Billet coupe-file')).toBeTruthy();
  });

  it('sans notes : pas de paragraphe de notes ; sans jour : le type seul', () => {
    const { container } = render(StepPopup, {
      props: {
        info: { ...info, notes: '', context: '' },
        canEdit: true,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      },
    });
    expect(container.querySelector('.notes')).toBeNull();
    expect(screen.getByText('Musée')).toBeTruthy();
  });

  it('boutons « Modifier » et « Supprimer »', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(props.onEdit).toHaveBeenCalledWith('s1');
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(props.onDelete).toHaveBeenCalledWith('s1');
  });

  it('lecture seule : pas de boutons', () => {
    setup({ canEdit: false });
    expect(screen.queryByRole('button')).toBeNull();
  });
});
