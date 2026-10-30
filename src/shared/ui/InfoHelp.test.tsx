import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoHelp } from './InfoHelp';

describe('InfoHelp', () => {
  it('opens accessibly and returns focus when dismissed with Escape', () => {
    render(<InfoHelp label="About planned values">Helpful explanation.</InfoHelp>);
    const trigger = screen.getByRole('button', { name: 'About planned values' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent('Helpful explanation.');
    fireEvent.keyDown(screen.getByRole('note'), { key: 'Escape' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
