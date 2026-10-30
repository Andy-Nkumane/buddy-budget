import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalForm } from './GoalForm';

describe('GoalForm', () => {
  it('creates a sinking fund with exact minor-unit values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<GoalForm categories={[]} accounts={[]} existingGoals={[]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Car service' } });
    fireEvent.change(screen.getByLabelText('Target amount'), { target: { value: '2500.50' } });
    fireEvent.change(screen.getByLabelText('Starting balance'), { target: { value: '100.25' } });
    fireEvent.change(screen.getByLabelText(/Planned monthly contribution/), {
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
          desired_contribution_minor: 20000,
          contribution_frequency: 'monthly',
          contribution_start_mode: 'this_month',
        }),
      ),
    );
  });

  it('rejects a debt payoff target above the starting debt', async () => {
    const onSave = vi.fn();
    render(<GoalForm categories={[]} accounts={[]} existingGoals={[]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Card' } });
    fireEvent.change(screen.getByLabelText('Goal type'), { target: { value: 'debt_paydown' } });
    fireEvent.change(screen.getByLabelText('Amount to pay down'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Starting debt balance'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Amount to pay down cannot exceed the starting debt balance.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('populates every editable field from the selected goal', () => {
    render(
      <GoalForm
        goal={{
          id: 'goal-1',
          user_id: 'user',
          name: 'Replace tyres',
          goal_type: 'sinking_fund',
          target_amount_minor: 125050,
          target_date: '2027-05-20',
          starting_balance_minor: 25000,
          desired_monthly_contribution_minor: null,
          desired_contribution_minor: 12500,
          contribution_frequency: 'fortnightly',
          contribution_start_mode: 'next_month',
          contribution_start_date: '2026-11-01',
          priority: 2,
          status: 'paused',
          category_id: null,
          account_id: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        }}
        categories={[]}
        accounts={[]}
        existingGoals={[]}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Goal name')).toHaveValue('Replace tyres');
    expect(screen.getByLabelText('Goal type')).toHaveValue('sinking_fund');
    expect(screen.getByLabelText('Target amount')).toHaveValue('1250.5');
    expect(screen.getByLabelText('Starting balance')).toHaveValue('250');
    expect(screen.getByLabelText(/Target date/)).toHaveValue('2027-05-20');
    expect(screen.getByLabelText('Contribution frequency')).toHaveValue('fortnightly');
    expect(screen.getByRole('combobox', { name: /Start contributions/ })).toHaveValue('next_month');
    expect(screen.getByLabelText(/Planned fortnightly contribution/)).toHaveValue('125');
    expect(screen.getByLabelText('Priority')).toHaveValue('2');
  });

  it('places normalized duplicate and date errors beside their fields', async () => {
    const onSave = vi.fn();
    render(
      <GoalForm
        categories={[]}
        accounts={[]}
        existingGoals={[
          {
            id: 'existing',
            user_id: 'user',
            name: 'Emergency Fund',
            goal_type: 'savings',
            target_amount_minor: 10000,
            target_date: null,
            starting_balance_minor: 0,
            desired_monthly_contribution_minor: null,
            desired_contribution_minor: null,
            contribution_frequency: 'monthly',
            contribution_start_mode: 'this_month',
            contribution_start_date: '2026-10-01',
            priority: 1,
            status: 'active',
            category_id: null,
            account_id: null,
            created_at: '',
            updated_at: '',
          },
        ]}
        timeZone="Africa/Johannesburg"
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Goal name'), {
      target: { value: ' emergency   fund ' },
    });
    fireEvent.change(screen.getByLabelText('Target amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Target date/), { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    expect(
      await screen.findByText('An ongoing or paused goal already uses this name.'),
    ).toBeVisible();
    expect(screen.getByText('Choose today or a future date.')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });
});
