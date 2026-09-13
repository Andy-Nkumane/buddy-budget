const activeEditors = new Set<string>();

export interface BudgetEditStateDetail {
  editorId: string;
  editing: boolean;
  editingCount: number;
}

export const setBudgetEditorState = (editorId: string, editing: boolean): void => {
  if (editing) activeEditors.add(editorId);
  else activeEditors.delete(editorId);
  window.dispatchEvent(
    new CustomEvent<BudgetEditStateDetail>('buddybudget-edit-state', {
      detail: { editorId, editing, editingCount: activeEditors.size },
    }),
  );
};

export const hasActiveBudgetEditors = (): boolean => activeEditors.size > 0;
