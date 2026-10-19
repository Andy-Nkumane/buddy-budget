import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './AsyncState';

describe('LoadingState', () => {
  it('shows the branded loader with an accessible status label', () => {
    const { container } = render(<LoadingState label="Opening your budget…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Opening your budget…');
    expect(container.querySelector('.brand-loader .brand-mark')).toHaveAttribute(
      'src',
      expect.stringContaining('icons/icon-192.png'),
    );
  });
});
