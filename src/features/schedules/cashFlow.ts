import type {
  BudgetTransaction,
  PaymentScheduleOccurrence,
  ScheduleRecurrence,
} from '../../shared/types/domain';

const parseDate = (value: string): Date => new Date(`${value}T00:00:00Z`);
const formatDate = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number): string => {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

export const currentDateInTimeZone = (timeZone?: string, date = new Date()): string => {
  if (!timeZone) return formatDate(date);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    return formatDate(date);
  }
  return formatDate(date);
};

export const isOccurrenceDate = (
  date: string,
  startDate: string,
  recurrence: ScheduleRecurrence,
  selectedDays: number[] = [],
): boolean => {
  const current = parseDate(date);
  const start = parseDate(startDate);
  const elapsedDays = Math.round((current.getTime() - start.getTime()) / 86_400_000);
  if (elapsedDays < 0) return false;
  if (recurrence === 'weekly') return elapsedDays % 7 === 0;
  if (recurrence === 'fortnightly') return elapsedDays % 14 === 0;
  if (recurrence === 'selected_days') {
    const isoDay = current.getUTCDay() || 7;
    return selectedDays.includes(isoDay);
  }
  const targetDay = start.getUTCDate();
  const lastDay = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return current.getUTCDate() === Math.min(targetDay, lastDay);
};

export const generateOccurrenceDates = (input: {
  startDate: string;
  endDate: string;
  recurrence: ScheduleRecurrence;
  selectedDays?: number[];
}): string[] => {
  const dates: string[] = [];
  for (let date = input.startDate; date <= input.endDate; date = addDays(date, 1)) {
    if (isOccurrenceDate(date, input.startDate, input.recurrence, input.selectedDays)) {
      dates.push(date);
    }
  }
  return dates;
};

export type CashFlowDay = {
  date: string;
  postedMinor: number;
  forecastMinor: number;
  balanceMinor: number;
};

export const addMinorUnitsExact = (left: number, right: number): number => {
  const result = left + right;
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(result)
  ) {
    throw new Error('The cash-flow total is too large to calculate safely.');
  }
  return result;
};

const transactionCashEffect = (entry: BudgetTransaction): number => {
  if (entry.status !== 'posted') return 0;
  const direction = entry.transaction_type === 'income' ? 1 : -1;
  return direction * (entry.is_refund ? -entry.amount_minor : entry.amount_minor);
};

export const calculateCashFlowProjection = (input: {
  fromDate: string;
  toDate: string;
  openingBalanceMinor: number;
  transactions: BudgetTransaction[];
  occurrences: PaymentScheduleOccurrence[];
}): { days: CashFlowDay[]; lowestBalanceMinor: number } => {
  const postedByDate = new Map<string, number>();
  input.transactions.forEach((entry) => {
    postedByDate.set(
      entry.transaction_date,
      addMinorUnitsExact(
        postedByDate.get(entry.transaction_date) ?? 0,
        transactionCashEffect(entry),
      ),
    );
  });
  const forecastByDate = new Map<string, number>();
  input.occurrences
    .filter((entry) => entry.status === 'expected' && entry.matched_transaction_id === null)
    .forEach((entry) => {
      const effect = entry.item_type === 'income' ? entry.amount_minor : -entry.amount_minor;
      const forecastDate = entry.due_date < input.fromDate ? input.fromDate : entry.due_date;
      forecastByDate.set(
        forecastDate,
        addMinorUnitsExact(forecastByDate.get(forecastDate) ?? 0, effect),
      );
    });

  const days: CashFlowDay[] = [];
  let balanceMinor = input.openingBalanceMinor;
  let lowestBalanceMinor = balanceMinor;
  for (let date = input.fromDate; date <= input.toDate; date = addDays(date, 1)) {
    const postedMinor = postedByDate.get(date) ?? 0;
    const forecastMinor = forecastByDate.get(date) ?? 0;
    balanceMinor = addMinorUnitsExact(balanceMinor, addMinorUnitsExact(postedMinor, forecastMinor));
    lowestBalanceMinor = Math.min(lowestBalanceMinor, balanceMinor);
    days.push({ date, postedMinor, forecastMinor, balanceMinor });
  }
  return { days, lowestBalanceMinor };
};

export const findUncertainOccurrenceMatches = (
  occurrence: PaymentScheduleOccurrence,
  transactions: BudgetTransaction[],
): BudgetTransaction[] =>
  transactions.filter(
    (entry) =>
      entry.status === 'posted' &&
      entry.transaction_type === occurrence.item_type &&
      entry.amount_minor === occurrence.amount_minor &&
      Math.abs(
        (parseDate(entry.transaction_date).getTime() - parseDate(occurrence.due_date).getTime()) /
          86_400_000,
      ) <= 3,
  );
