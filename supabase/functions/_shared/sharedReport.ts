export const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const createShareToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const text = (value: unknown, maximum: number) =>
  typeof value === 'string' && value.length <= maximum ? value : null;
const integer = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : null;

export const sanitizeSharedReportSnapshot = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1 || !Array.isArray(source.months) || source.months.length > 120)
    return null;
  const title = text(source.title, 100);
  const rangeLabel = text(source.rangeLabel, 120);
  const snapshotAt = text(source.snapshotAt, 40);
  const locale = text(source.locale, 35);
  const selection = source.selection as Record<string, unknown> | null;
  if (!title || !rangeLabel || !snapshotAt || !locale || !selection) return null;
  const scope = {
    totals: selection.totals === true,
    categories: selection.categories === true,
    transactions: selection.transactions === true,
    transactionNames: selection.transactionNames === true,
    notes: selection.notes === true,
    goals: selection.goals === true,
  };
  if (scope.transactionNames && !scope.transactions) return null;
  const months = source.months.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const month = entry as Record<string, unknown>;
    const monthStart = text(month.monthStart, 10);
    const currencyCode = text(month.currencyCode, 3);
    if (!monthStart?.match(/^\d{4}-\d{2}-01$/) || !currencyCode?.match(/^[A-Z]{3}$/)) return null;
    const clean: Record<string, unknown> = { monthStart, currencyCode };
    if (scope.totals) {
      const totals = month.totals as Record<string, unknown> | null;
      if (!totals) return null;
      const cleanTotals = {
        plannedIncomeMinor: integer(totals.plannedIncomeMinor),
        plannedExpenseMinor: integer(totals.plannedExpenseMinor),
        actualIncomeMinor: integer(totals.actualIncomeMinor),
        actualExpenseMinor: integer(totals.actualExpenseMinor),
        remainingMinor: integer(totals.remainingMinor),
      };
      if (Object.values(cleanTotals).some((amount) => amount === null)) return null;
      clean.totals = cleanTotals;
    }
    if (scope.categories) {
      if (!Array.isArray(month.categories) || month.categories.length > 1000) return null;
      clean.categories = month.categories.map((entry) => {
        const category = entry as Record<string, unknown>;
        const name = text(category?.name, 80);
        const itemType = category?.itemType;
        const plannedMinor = integer(category?.plannedMinor);
        const actualMinor = integer(category?.actualMinor);
        if (
          !name ||
          !['income', 'expense'].includes(String(itemType)) ||
          plannedMinor === null ||
          actualMinor === null
        )
          throw new Error('invalid_snapshot');
        return { name, itemType, plannedMinor, actualMinor };
      });
    }
    if (scope.transactions) {
      if (!Array.isArray(month.transactions) || month.transactions.length > 10000) return null;
      clean.transactions = month.transactions.map((entry) => {
        const transaction = entry as Record<string, unknown>;
        const date = text(transaction?.date, 10);
        const type = transaction?.type;
        const amountMinor = integer(transaction?.amountMinor);
        const name = scope.transactionNames ? text(transaction?.name, 200) : null;
        const category = text(transaction?.category, 80);
        const notes = scope.notes && transaction?.notes ? text(transaction.notes, 1000) : null;
        if (
          !date?.match(/^\d{4}-\d{2}-\d{2}$/) ||
          !['income', 'expense'].includes(String(type)) ||
          amountMinor === null ||
          !category ||
          (scope.transactionNames && !name)
        )
          throw new Error('invalid_snapshot');
        return {
          date,
          type,
          amountMinor,
          ...(name ? { name } : {}),
          category,
          ...(notes ? { notes } : {}),
        };
      });
    }
    if (scope.notes && month.notes) {
      const notes = text(month.notes, 2000);
      if (!notes) return null;
      clean.notes = notes;
    }
    if (scope.goals) {
      if (!Array.isArray(month.goals) || month.goals.length > 500) return null;
      clean.goals = month.goals.map((entry) => {
        const goal = entry as Record<string, unknown>;
        const name = text(goal?.name, 100);
        const type = text(goal?.type, 30);
        const recommendedMinor = integer(goal?.recommendedMinor);
        const priority = integer(goal?.priority);
        if (!name || !type || recommendedMinor === null || priority === null)
          throw new Error('invalid_snapshot');
        return { name, type, recommendedMinor, priority };
      });
    }
    return clean;
  });
  if (months.some((month) => month === null)) return null;
  const omitted = Array.isArray(source.omitted)
    ? source.omitted
        .map((entry) => text(entry, 80))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  return { version: 1, title, rangeLabel, snapshotAt, locale, selection: scope, omitted, months };
};
