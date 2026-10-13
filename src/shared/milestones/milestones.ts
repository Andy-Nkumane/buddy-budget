import { claimActivationMilestone } from '../../data/repositories/budgetRepository';

export type ActivationMilestoneKey =
  | 'first_budget'
  | 'first_categorisation'
  | 'first_month_close'
  | 'first_goal_contribution'
  | 'first_export'
  | 'first_restore';

export const milestoneDetails: Record<
  ActivationMilestoneKey,
  { title: string; message: string; action: string; path: string }
> = {
  first_budget: {
    title: 'Your first budget is ready',
    message: 'Your plan is in place. Record an actual transaction to keep it useful.',
    action: 'Add a transaction',
    path: '/app/transactions',
  },
  first_categorisation: {
    title: 'Your first transaction is organised',
    message: 'Categorised activity makes your planned-versus-actual view easier to trust.',
    action: 'Review your budget',
    path: '/app/budget/current',
  },
  first_month_close: {
    title: 'Your first month is closed',
    message: 'The close summary is preserved. Review the next month when you are ready.',
    action: 'View your months',
    path: '/app/months',
  },
  first_goal_contribution: {
    title: 'Your first contribution is recorded',
    message: 'Your goal progress now reflects this contribution.',
    action: 'Review your goals',
    path: '/app/goals',
  },
  first_export: {
    title: 'Your first export is complete',
    message: 'Keep the downloaded file somewhere private and secure.',
    action: 'Review data controls',
    path: '/app/settings',
  },
  first_restore: {
    title: 'Your first restore is complete',
    message: 'Review the restored dashboard and keep the restore report for reference.',
    action: 'Review your budget',
    path: '/app/budget/current',
  },
};

export const milestoneEventName = 'buddy-budget:milestone';
const pendingKey = 'buddy-budget:pending-milestone';

export const claimAndAnnounceMilestone = async (key: ActivationMilestoneKey): Promise<boolean> => {
  const claimed = await claimActivationMilestone(key);
  if (!claimed) return false;
  try {
    sessionStorage.setItem(pendingKey, key);
  } catch {
    window.dispatchEvent(new CustomEvent(milestoneEventName, { detail: key }));
    return claimed;
  }
  window.dispatchEvent(new CustomEvent(milestoneEventName, { detail: key }));
  return true;
};

export const takePendingMilestone = (): ActivationMilestoneKey | null => {
  try {
    const key = sessionStorage.getItem(pendingKey) as ActivationMilestoneKey | null;
    sessionStorage.removeItem(pendingKey);
    return key && key in milestoneDetails ? key : null;
  } catch {
    return null;
  }
};
