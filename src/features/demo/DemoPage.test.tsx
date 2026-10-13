import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoPage } from './DemoPage';

describe('DemoPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates local actuals and resets without network access', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<DemoPage />);

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '75.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sample transaction' }));
    expect(screen.getByText('Coffee')).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lets visitors adjust planned values locally', () => {
    render(<DemoPage />);
    const input = screen.getByLabelText('Planned Groceries');
    fireEvent.change(input, { target: { value: '6000.00' } });
    fireEvent.blur(input);
    const plannedRemaining = screen.getByText('Planned remaining').closest('article');
    expect(plannedRemaining).not.toBeNull();
    expect(within(plannedRemaining!).getByText(/19.*700/)).toBeVisible();
  });

  it('disables starter-plan conversion offline and restores it when online', () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    render(<DemoPage />);

    const conversion = screen.getByRole('button', { name: /Start with this setup/ });
    expect(conversion).toBeDisabled();
    expect(screen.getByText(/will become available when you are back online/i)).toBeVisible();

    online.mockReturnValue(true);
    fireEvent(window, new Event('online'));
    expect(conversion).toBeEnabled();
    expect(
      screen.queryByText(/will become available when you are back online/i),
    ).not.toBeInTheDocument();
  });
});
