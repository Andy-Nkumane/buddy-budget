import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalForm } from './GoalForm';

describe('GoalForm', () => {
  it('creates a sinking fund with exact minor-unit values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<GoalForm categories={[]} accounts={[]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Car service' } });
    fireEvent.change(screen.getByLabelText('Target amount'), { target: { value: '2500.50' } });
    fireEvent.change(screen.getByLabelText('Starting balance'), { target: { value: '100.25' } });
    fireEvent.change(screen.getByLabelText(/Desired monthly contribution/), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Car service',
          goal_type: 'sinking_fund',
          target_amount_minor: 250050,
          starting_balance_minor: 10025,
          desired_monthly_contribution_minor: 20000,
        }),
      ),
    );
  });

  it('rejects a debt payoff target above the starting debt', async () => {
    const onSave = vi.fn();
    render(<GoalForm categories={[]} accounts={[]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Card' } });
    fireEvent.change(screen.getByLabelText('Goal type'), { target: { value: 'debt_paydown' } });
    fireEvent.change(screen.getByLabelText('Amount to pay down'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Starting debt balance'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A debt payoff target cannot exceed the starting debt balance.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
