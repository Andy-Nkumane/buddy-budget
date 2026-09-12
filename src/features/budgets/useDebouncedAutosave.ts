import { useCallback, useEffect, useReducer, useRef } from 'react';
import { parseMoney, toDatabaseMoney } from '../../shared/validation/schemas';
import { autosaveReducer, createAutosaveState } from './autosaveMachine';

export const useDebouncedAutosave = (
  initialValue: string,
  save: (value: string) => Promise<void>,
  onDraft: (value: string) => void,
  delay = 650,
) => {
  const [state, dispatch] = useReducer(autosaveReducer, initialValue, createAutosaveState);
  const saveRef = useRef(save);
  const draftRef = useRef(onDraft);

  useEffect(() => {
    saveRef.current = save;
    draftRef.current = onDraft;
  }, [onDraft, save]);

  const persist = useCallback(async (value: string) => {
    const parsed = parseMoney(value);
    if (parsed === null) {
      dispatch({ type: 'failed', error: 'Enter a valid amount with no more than two decimals.' });
      return;
    }
    if (!navigator.onLine) {
      dispatch({ type: 'failed', error: 'Offline — this edit is not saved yet.' });
      return;
    }
    dispatch({ type: 'saving' });
    try {
      const normalized = toDatabaseMoney(parsed);
      await saveRef.current(normalized);
      dispatch({ type: 'saved', value: normalized });
    } catch (error) {
      dispatch({
        type: 'failed',
        error: error instanceof Error ? error.message : 'Save failed. Try again.',
      });
    }
  }, []);

  useEffect(() => {
    if (
      state.value === state.persistedValue ||
      state.status === 'saving' ||
      state.status === 'failed'
    )
      return;
    const timeout = window.setTimeout(() => void persist(state.value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, persist, state.persistedValue, state.status, state.value]);

  useEffect(() => {
    const editing = state.value !== state.persistedValue || state.status === 'saving';
    window.dispatchEvent(new CustomEvent('buddybudget-edit-state', { detail: { editing } }));
  }, [state.persistedValue, state.status, state.value]);

  const setValue = (value: string) => {
    dispatch({ type: 'edit', value });
    draftRef.current(value);
  };

  return { ...state, setValue, retry: () => void persist(state.value) };
};
