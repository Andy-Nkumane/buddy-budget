export type SharedTemplateItem = {
  key: string;
  name: string;
  itemType: 'income' | 'expense';
  categoryName: string;
  sortOrder: number;
  amount?: string;
};

export type SharedTemplateSnapshot = {
  schemaVersion: 1;
  name: string;
  version: number;
  includesAmounts: boolean;
  items: SharedTemplateItem[];
};

export const pendingSharedTemplateKey = 'buddy-budget:pending-shared-template';

export const retrievePendingSharedTemplateToken = () => {
  try {
    return sessionStorage.getItem(pendingSharedTemplateKey) ?? '';
  } catch {
    return '';
  }
};

export const savePendingSharedTemplateToken = (token: string) => {
  try {
    sessionStorage.setItem(pendingSharedTemplateKey, token);
  } catch {
    return;
  }
};

export const clearPendingSharedTemplateToken = () => {
  try {
    sessionStorage.removeItem(pendingSharedTemplateKey);
  } catch {
    return;
  }
};
