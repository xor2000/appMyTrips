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

  it('sous-titre facultatif sous le titre (comme la maquette), qui décrit la fenêtre', () => {
    render(Modal, {
      props: {
        title: 'Modifier le lieu',
        subtitle: 'Mettez à jour ce lieu.',
        onClose: vi.fn(),
        children,
      },
    });
    const dialog = screen.getByRole('dialog', { name: 'Modifier le lieu' });
    const id = dialog.getAttribute('aria-describedby');
    expect(id && document.getElementById(id)?.textContent).toBe('Mettez à jour ce lieu.');
  });

  it('sans sous-titre : pas de description', () => {
    render(Modal, { props: { title: 'Confirmer', onClose: vi.fn(), children } });
    expect(screen.getByRole('dialog').hasAttribute('aria-describedby')).toBe(false);
  });

  it('le focus va au contenu, pas au bouton de fermeture', () => {
    render(Modal, { props: { title: 'Confirmer', onClose: vi.fn(), children, actions } });
    expect(document.activeElement?.textContent).toBe('Valider');
  });

  it('masquée (choix sur la carte) : invisible, Échap ne la ferme pas', async () => {
    const onClose = vi.fn();
    render(Modal, { props: { title: 'Modifier', hidden: true, onClose, children } });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Échap déjà traité ailleurs (abandon du choix sur la carte) : la fenêtre reste ouverte', async () => {
    const onClose = vi.fn();
    render(Modal, { props: { title: 'Modifier', onClose, children } });
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Échap ferme la fenêtre', async () => {
    const onClose = vi.fn();
    render(Modal, { props: { title: 'Confirmer', onClose, children } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
