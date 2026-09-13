import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasActiveBudgetEditors, setBudgetEditorState } from './editState';

describe('budget edit state', () => {
  afterEach(() => {
    setBudgetEditorState('first', false);
    setBudgetEditorState('second', false);
  });

  it('remains active until every editor is clean', () => {
    const listener = vi.fn();
    window.addEventListener('buddybudget-edit-state', listener);
    setBudgetEditorState('first', true);
    setBudgetEditorState('second', true);
    setBudgetEditorState('first', false);
    expect(hasActiveBudgetEditors()).toBe(true);
    expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({ detail: { editingCount: 1 } });
    setBudgetEditorState('second', false);
    expect(hasActiveBudgetEditors()).toBe(false);
    window.removeEventListener('buddybudget-edit-state', listener);
  });
});
