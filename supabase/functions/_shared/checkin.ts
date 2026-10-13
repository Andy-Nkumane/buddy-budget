export type CheckInPosition = {
  plannedIncomeMinor: number;
  plannedExpenseMinor: number;
  actualIncomeMinor: number;
  actualExpenseMinor: number;
};

export type CheckInItem = {
  name: string;
  plannedMinor: number;
  actualMinor: number;
};

export type CheckInObligation = {
  name: string;
  dueDate: string;
  amountMinor: number;
  itemType: 'income' | 'expense';
};

export type CheckInGoal = {
  name: string;
  remainingMinor: number;
  onTrack: boolean;
};

export type WeeklyCheckInSummary = {
  currencyCode?: string;
  locale?: string;
  position: CheckInPosition & { plannedRemainingMinor: number; actualRemainingMinor: number };
  approachingItems: CheckInItem[];
  exceededItems: CheckInItem[];
  uncategorisedCount: number;
  upcomingObligations: CheckInObligation[];
  goals: CheckInGoal[];
  recommendation: { title: string; body: string; actionPath: string };
};

export type CheckInSource = {
  currencyCode?: string;
  locale?: string;
  position: CheckInPosition;
  expenseItems: CheckInItem[];
  uncategorisedCount: number;
  upcomingObligations: CheckInObligation[];
  goals: CheckInGoal[];
};

export const buildWeeklyCheckInSummary = (source: CheckInSource): WeeklyCheckInSummary => {
  const exceededItems = source.expenseItems.filter(
    (item) => item.plannedMinor >= 0 && item.actualMinor > item.plannedMinor,
  );
  const approachingItems = source.expenseItems.filter(
    (item) =>
      item.plannedMinor > 0 &&
      item.actualMinor <= item.plannedMinor &&
      item.actualMinor * 100 >= item.plannedMinor * 80,
  );
  const position = {
    ...source.position,
    plannedRemainingMinor: source.position.plannedIncomeMinor - source.position.plannedExpenseMinor,
    actualRemainingMinor: source.position.actualIncomeMinor - source.position.actualExpenseMinor,
  };
  let recommendation = {
    title: 'Keep your plan current',
    body: 'Review this week’s activity and keep going.',
    actionPath: '/app/budget/current',
  };
  if (source.uncategorisedCount > 0) {
    recommendation = {
      title: 'Categorise recent activity',
      body: `${source.uncategorisedCount} transaction${source.uncategorisedCount === 1 ? '' : 's'} need attention.`,
      actionPath: '/app/transactions',
    };
  } else if (exceededItems.length > 0) {
    recommendation = {
      title: 'Review an exceeded budget',
      body: `${exceededItems[0].name} is above its plan.`,
      actionPath: '/app/budget/current',
    };
  } else if (source.upcomingObligations.some((item) => item.itemType === 'expense')) {
    recommendation = {
      title: 'Prepare for what is due',
      body: `${source.upcomingObligations[0].name} is coming up soon.`,
      actionPath: '/app/cash-flow',
    };
  } else if (source.goals.some((goal) => !goal.onTrack)) {
    recommendation = {
      title: 'Check an off-track goal',
      body: `${source.goals.find((goal) => !goal.onTrack)?.name ?? 'A goal'} needs attention.`,
      actionPath: '/app/goals',
    };
  } else if (approachingItems.length > 0) {
    recommendation = {
      title: 'Watch an approaching limit',
      body: `${approachingItems[0].name} has used at least 80% of its plan.`,
      actionPath: '/app/budget/current',
    };
  }
  return {
    currencyCode: source.currencyCode,
    locale: source.locale,
    position,
    approachingItems,
    exceededItems,
    uncategorisedCount: source.uncategorisedCount,
    upcomingObligations: source.upcomingObligations,
    goals: source.goals,
    recommendation,
  };
};

const retrieveZonedParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    weekday: weekdays[find('weekday')],
    hour: Number(find('hour')),
    minute: Number(find('minute')),
  };
};

export const isWeeklyDeliveryDue = (input: {
  now: Date;
  timezone: string;
  weekday: number;
  deliveryTime: string;
  windowMinutes?: number;
}): boolean => {
  const local = retrieveZonedParts(input.now, input.timezone);
  const [hour, minute] = input.deliveryTime.split(':').map(Number);
  const elapsed = local.hour * 60 + local.minute - (hour * 60 + minute);
  return local.weekday === input.weekday && elapsed >= 0 && elapsed < (input.windowMinutes ?? 30);
};
