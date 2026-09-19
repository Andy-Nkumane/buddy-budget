import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleForm } from './ScheduleForm';

describe('ScheduleForm', () => {
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
