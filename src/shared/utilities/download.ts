import {
  calculateBudgetProgress,
  calculateItemProgress,
  formatMoney,
  formatMonth,
} from '../formatting/money';
import {
  calculateReportTotalsByCurrency,
  formatSignedReportAmount,
  formatSignedTransactionAmount,
} from '../reporting/budgetReport';
import type { BudgetMonthWithItems, Profile } from '../types/domain';

const saveBlob = (filename: string, type: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadJson = (filename: string, value: unknown): void => {
  saveBlob(filename, 'application/json;charset=utf-8', JSON.stringify(value, null, 2));
};

export const escapeCsv = (value: string | number): string => {
  const stringValue = String(value);
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const downloadMonthsCsv = (months: BudgetMonthWithItems[], filenameRange: string): void => {
  const rows = [
    [
      'record_type',
      'month',
      'currency',
      'type',
      'name',
      'category',
      'budget_item',
      'planned_amount',
      'actual_amount',
      'variance',
      'remaining',
      'transaction_date',
      'status',
      'source',
      'refund_or_reversal',
    ],
    ...months.flatMap((month) => {
      const summary = calculateBudgetProgress(month.budget_month_items, month.budget_transactions);
      return [
        [
          'month_summary',
          month.month_start,
          month.currency_code,
          'income',
          'Month income summary',
          '',
          '',
          summary.planned.income.toFixed(2),
          summary.actual.income.toFixed(2),
          summary.incomeVariance.toFixed(2),
          summary.incomeRemaining.toFixed(2),
          '',
          '',
          '',
          '',
        ],
        [
          'month_summary',
          month.month_start,
          month.currency_code,
          'expense',
          'Month expense summary',
          '',
          '',
          summary.planned.expenses.toFixed(2),
          summary.actual.expenses.toFixed(2),
          summary.expenseVariance.toFixed(2),
          summary.expenseRemaining.toFixed(2),
          '',
          '',
          '',
          '',
        ],
        ...month.budget_month_items.map((item) => {
          const progress = calculateItemProgress(item, month.budget_transactions);
          return [
            'budget_item',
            month.month_start,
            month.currency_code,
            item.item_type,
            item.name_snapshot,
            item.category_snapshot ?? '',
            item.name_snapshot,
            progress.planned.toFixed(2),
            progress.actual.toFixed(2),
            progress.variance.toFixed(2),
            progress.remaining.toFixed(2),
            '',
            item.is_disabled ? 'paused' : 'active',
            item.source_template_item_id ? 'recurring' : 'one-off',
            '',
          ];
        }),
        ...month.budget_transactions.map((transaction) => [
          'transaction',
          month.month_start,
          month.currency_code,
          transaction.transaction_type,
          transaction.description,
          transaction.category_snapshot ?? '',
          transaction.budget_item_snapshot ?? '',
          '',
          (transaction.amount_minor / 100).toFixed(2),
          '',
          '',
          transaction.transaction_date,
          transaction.status,
          transaction.source,
          transaction.is_refund ? 'yes' : 'no',
        ]),
      ];
    }),
  ];
  saveBlob(
    `buddybudget-${filenameRange}.csv`,
    'text/csv;charset=utf-8',
    rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n'),
  );
};

export const downloadMonthCsv = (month: BudgetMonthWithItems): void => {
  downloadMonthsCsv([month], month.month_start.slice(0, 7));
};

export const downloadBudgetReportPdf = async (
  months: BudgetMonthWithItems[],
  profile: Profile,
  rangeLabel: string,
  filenameRange: string,
): Promise<void> => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ unit: 'pt', format: 'a4' });
  const documentWithTable = document as typeof document & {
    lastAutoTable?: { finalY?: number };
  };
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 40;
  const locale = profile.locale;
  const incomeColor = [36, 112, 82] as [number, number, number];
  const expenseColor = [173, 55, 55] as [number, number, number];
  const bodyColor = [64, 84, 80] as [number, number, number];
  let cursorY = 44;

  document.setTextColor(25, 79, 71);
  document.setFontSize(10);
  document.text('BUDDY BUDGET REPORT', margin, cursorY);
  cursorY += 24;
  document.setTextColor(23, 37, 34);
  document.setFontSize(22);
  document.text(rangeLabel, margin, cursorY);
  cursorY += 20;
  document.setTextColor(64, 84, 80);
  document.setFontSize(10);
  document.text(
    `Prepared for ${profile.display_name || 'Buddy Budget user'} on ${new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())}.`,
    margin,
    cursorY,
  );
  cursorY += 18;

  const summaryTotals = calculateReportTotalsByCurrency(months);
  autoTable(document, {
    startY: cursorY,
    head: [['Currency', 'Planned income', 'Actual income', 'Planned expenses', 'Actual expenses']],
    body: summaryTotals.map((totals) => [
      totals.currency,
      formatMoney(totals.plannedIncome, totals.currency, locale),
      formatSignedReportAmount(totals.actualIncome, 'income', totals.currency, locale),
      formatMoney(totals.plannedExpenses, totals.currency, locale),
      formatSignedReportAmount(totals.actualExpenses, 'expense', totals.currency, locale),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [25, 79, 71], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 6 },
    didParseCell: (cell) => {
      if (cell.section !== 'body' || cell.column.index === 0) return;
      cell.cell.styles.fontStyle = 'bold';
      if (cell.column.index === 2) cell.cell.styles.textColor = incomeColor;
      if (cell.column.index === 4) cell.cell.styles.textColor = expenseColor;
    },
  });
  cursorY = (documentWithTable.lastAutoTable?.finalY ?? cursorY) + 24;

  months.forEach((month) => {
    if (cursorY > pageHeight - 160) {
      document.addPage();
      cursorY = 44;
    }
    const progress = calculateBudgetProgress(month.budget_month_items, month.budget_transactions);
    document.setTextColor(23, 37, 34);
    document.setFontSize(15);
    document.text(formatMonth(month.month_start, locale), margin, cursorY);
    cursorY += 16;
    document.setFontSize(9);
    let cursorX = margin;
    const drawTotal = (label: string, value: string, color: [number, number, number]) => {
      document.setFont('helvetica', 'normal');
      document.setTextColor(...bodyColor);
      document.text(`${label} `, cursorX, cursorY);
      cursorX += document.getTextWidth(`${label} `);
      document.setFont('helvetica', 'bold');
      document.setTextColor(...color);
      document.text(value, cursorX, cursorY);
      cursorX += document.getTextWidth(value) + 14;
    };
    drawTotal(
      'Income',
      `${formatMoney(progress.planned.income, month.currency_code, locale)} planned / ${formatSignedReportAmount(progress.actual.income, 'income', month.currency_code, locale)} actual`,
      incomeColor,
    );
    drawTotal(
      'Expenses',
      `${formatMoney(progress.planned.expenses, month.currency_code, locale)} planned / ${formatSignedReportAmount(progress.actual.expenses, 'expense', month.currency_code, locale)} actual`,
      expenseColor,
    );
    drawTotal(
      'Available',
      formatMoney(progress.available, month.currency_code, locale),
      progress.available < 0 ? expenseColor : incomeColor,
    );
    document.setFont('helvetica', 'normal');
    cursorY += 10;
    autoTable(document, {
      startY: cursorY,
      head: [['Item', 'Status', 'Planned', 'Actual', 'Remaining']],
      body: month.budget_month_items.map((item) => {
        const itemProgress = calculateItemProgress(item, month.budget_transactions);
        return [
          `${item.name_snapshot} · ${item.category_snapshot ?? 'Uncategorised'}`,
          item.is_disabled ? 'Paused' : 'Active',
          formatMoney(itemProgress.planned, month.currency_code, locale),
          formatMoney(itemProgress.actual, month.currency_code, locale),
          formatMoney(itemProgress.remaining, month.currency_code, locale),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [229, 239, 236], textColor: [23, 37, 34] },
      styles: { fontSize: 8.5, cellPadding: 5 },
      columnStyles: { 3: { halign: 'right' } },
      didParseCell: (cell) => {
        if (cell.section !== 'body' || cell.column.index !== 3) return;
        cell.cell.styles.fontStyle = 'bold';
        cell.cell.styles.textColor =
          month.budget_month_items[cell.row.index].item_type === 'income'
            ? incomeColor
            : expenseColor;
      },
    });
    cursorY = (documentWithTable.lastAutoTable?.finalY ?? cursorY) + 24;
    if (month.budget_transactions.length) {
      autoTable(document, {
        startY: cursorY,
        head: [['Date', 'Transaction', 'Assignment', 'Status', 'Amount']],
        body: month.budget_transactions.map((transaction) => [
          transaction.transaction_date,
          transaction.description,
          transaction.budget_item_snapshot ?? transaction.category_snapshot ?? 'Unassigned',
          transaction.is_refund ? `${transaction.status} refund` : transaction.status,
          formatSignedTransactionAmount(transaction, month.currency_code, locale),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [229, 239, 236], textColor: [23, 37, 34] },
        styles: { fontSize: 8.5, cellPadding: 5 },
        columnStyles: { 4: { halign: 'right' } },
        didParseCell: (cell) => {
          if (cell.section !== 'body' || cell.column.index !== 4) return;
          const transaction = month.budget_transactions[cell.row.index];
          const positiveCashFlow =
            (transaction.transaction_type === 'income' && !transaction.is_refund) ||
            (transaction.transaction_type === 'expense' && transaction.is_refund);
          cell.cell.styles.fontStyle = 'bold';
          cell.cell.styles.textColor = positiveCashFlow ? incomeColor : expenseColor;
        },
      });
      cursorY = (documentWithTable.lastAutoTable?.finalY ?? cursorY) + 24;
    }
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFontSize(8);
    document.setTextColor(109, 125, 121);
    document.text(
      `Paused items are excluded from plans; posted transactions remain actual.  Page ${page} of ${pageCount}`,
      margin,
      pageHeight - 24,
    );
  }
  document.save(`buddybudget-${filenameRange}.pdf`);
};
