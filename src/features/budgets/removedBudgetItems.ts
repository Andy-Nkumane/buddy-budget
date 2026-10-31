export const BUDGET_ITEM_RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const getBudgetItemRestoreDeadline = (archivedAt: string) =>
  new Date(archivedAt).getTime() + BUDGET_ITEM_RESTORE_WINDOW_MS;

export const canRestoreBudgetItem = (archivedAt: string, now = Date.now()) =>
  getBudgetItemRestoreDeadline(archivedAt) > now;

export const formatBudgetItemRestoreCountdown = (archivedAt: string, now = Date.now()) => {
  const remaining = Math.max(0, getBudgetItemRestoreDeadline(archivedAt) - now);
  if (remaining === 0) return 'Removal pending';
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m remaining`;
  return `${hours}h ${minutes}m remaining`;
};
