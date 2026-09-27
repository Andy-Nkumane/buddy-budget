import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduleForm } from './ScheduleForm';

describe('ScheduleForm', () => {
  afterEach(() => vi.useRealTimers());

  it('defaults the start date to today in the profile timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T22:30:00Z'));
    render(
      <ScheduleForm
        categories={[]}
        templates={[]}
        timezone="Africa/Johannesburg"
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-27');
    expect(screen.getByLabelText('Starts')).toHaveAttribute('min', '2026-09-27');
  });

  it('rejects a new schedule starting before today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
    const onSave = vi.fn();
    render(
      <ScheduleForm
        categories={[]}
        templates={[]}
        timezone="Africa/Johannesburg"
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText('Schedule name'), { target: { value: 'Old bill' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-09-26' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create schedule' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose today or a future date.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits a once payment without an end date', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ScheduleForm
        categories={[]}
        templates={[]}
        timezone="Africa/Johannesburg"
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText('Schedule name'), { target: { value: 'Once fee' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Recurrence'), { target: { value: 'once' } });
    expect(screen.getByLabelText('Payment date')).toBeVisible();
    expect(screen.queryByLabelText('Ends (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ recurrence: 'once', end_date: null, selected_days: [] }),
      ),
    );
  });

  it('requires a weekday for selected-day recurrence and submits exact minor units', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ScheduleForm
        categories={[]}
        templates={[]}
        timezone="Africa/Johannesburg"
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText('Schedule name'), { target: { value: 'Rent' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1234.56' } });
    fireEvent.change(screen.getByLabelText('Recurrence'), {
      target: { value: 'selected_days' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one weekday.');
    fireEvent.click(screen.getByLabelText('Monday'));
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rent',
          amount_minor: 123456,
          recurrence: 'selected_days',
          selected_days: [1],
          timezone: 'Africa/Johannesburg',
        }),
      ),
    );
  });
});
