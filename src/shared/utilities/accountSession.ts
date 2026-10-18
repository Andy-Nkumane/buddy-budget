const activeHouseholdKey = 'buddy-budget-active-household';
const onboardingKeyPrefix = 'buddy-budget-onboarding:';
const monthSignalPrefix = 'buddybudget-month-';
const pendingMilestoneKey = 'buddy-budget:pending-milestone';

export const clearAccountBrowserState = (userId: string): void => {
  try {
    window.localStorage.removeItem(activeHouseholdKey);
    window.localStorage.removeItem(`${onboardingKeyPrefix}${userId}`);
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(monthSignalPrefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Browser storage can be unavailable; session cleanup must still continue.
  }
  try {
    window.sessionStorage.removeItem(pendingMilestoneKey);
  } catch {
    // Browser storage can be unavailable; session cleanup must still continue.
  }
};
