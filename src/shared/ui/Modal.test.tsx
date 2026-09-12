import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('exposes an accessible name and closes from its labelled control', () => {
    const close = vi.fn();
    render(
      <Modal open title="Add expense" description="One month only" onClose={close}>
        <button>Focusable content</button>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toHaveAccessibleDescription(
      'One month only',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
