import { describe, expect, it } from 'vitest';
import { autosaveReducer, createAutosaveState } from './autosaveMachine';

describe('autosave state transitions', () => {
  it('moves from edit through saving to saved', () => {
    const edited = autosaveReducer(createAutosaveState('10.00'), { type: 'edit', value: '12' });
    expect(edited.status).toBe('idle');
    const saving = autosaveReducer(edited, { type: 'saving' });
    expect(saving.status).toBe('saving');
    expect(autosaveReducer(saving, { type: 'saved', value: '12.00' })).toEqual({
      value: '12.00',
      persistedValue: '12.00',
      status: 'saved',
      error: null,
    });
  });

  it('preserves the draft after a failure so it can be retried', () => {
    const edited = autosaveReducer(createAutosaveState('10.00'), { type: 'edit', value: '15' });
    const failed = autosaveReducer(edited, { type: 'failed', error: 'Network failed' });
    expect(failed.value).toBe('15');
    expect(failed.persistedValue).toBe('10.00');
    expect(failed.status).toBe('failed');
  });
});
