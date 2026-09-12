import type { SaveState } from '../../shared/types/domain';

export interface AutosaveState {
  value: string;
  persistedValue: string;
  status: SaveState;
  error: string | null;
}

export type AutosaveAction =
  | { type: 'edit'; value: string }
  | { type: 'saving' }
  | { type: 'saved'; value: string }
  | { type: 'failed'; error: string }
  | { type: 'reset'; value: string };

export const createAutosaveState = (value: string): AutosaveState => ({
  value,
  persistedValue: value,
  status: 'idle',
  error: null,
});

export const autosaveReducer = (state: AutosaveState, action: AutosaveAction): AutosaveState => {
  switch (action.type) {
    case 'edit':
      return { ...state, value: action.value, status: 'idle', error: null };
    case 'saving':
      return { ...state, status: 'saving', error: null };
    case 'saved':
      return { value: action.value, persistedValue: action.value, status: 'saved', error: null };
    case 'failed':
      return { ...state, status: 'failed', error: action.error };
    case 'reset':
      return createAutosaveState(action.value);
  }
};
