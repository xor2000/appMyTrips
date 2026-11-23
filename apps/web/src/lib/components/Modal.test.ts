import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Contenu</p>' }));
const actions = createRawSnippet(() => ({
  render: () => '<button type="button">Valider</button>',
}));

describe('Modal', () => {
  it('fenêtre nommée par son titre, avec un bouton de fermeture dans l’en-tête', async () => {
    const onClose = vi.fn();
    render(Modal, { props: { title: 'Gérer le voyage', onClose, children, actions } });
    const dialog = screen.getByRole('dialog', { name: 'Gérer le voyage' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Fermer la fenêtre' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('le focus va au contenu, pas au bouton de fermeture', () => {
    render(Modal, { props: { title: 'Confirmer', onClose: vi.fn(), children, actions } });
    expect(document.activeElement?.textContent).toBe('Valider');
  });

  it('Échap ferme la fenêtre', async () => {
    const onClose = vi.fn();
    render(Modal, { props: { title: 'Confirmer', onClose, children } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
