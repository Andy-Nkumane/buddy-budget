import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STARTER_PLAN_KEY } from '../demo/demoModel';
import { PublicBudgetCalculatorPage } from './PublicBudgetCalculatorPage';

vi.mock('../../shared/localization/preferenceOptions', () => ({
  currencyOptions: [{ value: 'ZAR', label: 'ZAR - South African Rand' }],
  localeOptions: [{ value: 'en-ZA', label: 'English (South Africa)' }],
  includePreferenceOption: <T extends { value: string }>(options: T[]) => options,
}));

const renderPage = () => render(<PublicBudgetCalculatorPage />);

describe('PublicBudgetCalculatorPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calculates locally and resets the plan', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();
    const amounts = screen.getAllByLabelText('Monthly amount');
    fireEvent.change(amounts[0], { target: { value: '1000.00' } });
    fireEvent.change(amounts[1], { target: { value: '250.50' } });
    expect(screen.getByText(/749[.,]50/)).toBeVisible();
    expect(screen.getByText('75.0%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getAllByLabelText('Monthly amount')[0]).toHaveValue('0.00');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows validation beside an invalid row', () => {
    renderPage();
    fireEvent.change(screen.getAllByLabelText('Monthly amount')[0], {
      target: { value: '-10' },
    });
    expect(screen.getByText(/non-negative amount/i)).toBeVisible();
  });

  it('stores only the approved plan when conversion is explicit', () => {
    renderPage();
    const conversion = screen.getByRole('button', {
      name: 'Create an account and save this plan',
    });
    fireEvent.click(conversion);
    const stored = localStorage.getItem(DEMO_STARTER_PLAN_KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain('transactions');
    const parsed = JSON.parse(stored ?? '{}') as { items?: unknown[] };
    expect(parsed.items).toHaveLength(3);
  });

  it('supports adding and removing an expense by keyboard-accessible controls', () => {
    renderPage();
    const expenses = screen.getByRole('region', { name: 'Money going out' });
    fireEvent.click(within(expenses).getByRole('button', { name: 'Add expense' }));
    expect(within(expenses).getAllByRole('group')).toHaveLength(3);
    fireEvent.click(within(expenses).getByRole('button', { name: 'Remove expense' }));
    expect(within(expenses).getAllByRole('group')).toHaveLength(2);
  });
});
