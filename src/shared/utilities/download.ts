import { calculateTotals, formatMoney, formatMonth } from '../formatting/money';
import {
  calculateReportTotalsByCurrency,
  formatSignedReportAmount,
} from '../reporting/budgetReport';
import type { BudgetMonthWithItems, Profile } from '../types/domain';

const saveBlob = (filename: string, type: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadJson = (filename: string, value: unknown): void => {
  saveBlob(filename, 'application/json;charset=utf-8', JSON.stringify(value, null, 2));
};

const escapeCsv = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

export const downloadMonthsCsv = (months: BudgetMonthWithItems[], filenameRange: string): void => {
  const rows = [
    ['month', 'currency', 'type', 'name', 'category', 'amount', 'status', 'recurring'],
    ...months.flatMap((month) =>
      month.budget_month_items.map((item) => [
        month.month_start,
        month.currency_code,
        item.item_type,
        item.name_snapshot,
        item.category_snapshot ?? '',
        item.amount,
        item.is_disabled ? 'paused' : 'active',
        item.source_template_item_id ? 'yes' : 'no',
      ]),
    ),
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
  document.text('BUDDYBUDGET REPORT', margin, cursorY);
  cursorY += 24;
  document.setTextColor(23, 37, 34);
  document.setFontSize(22);
  document.text(rangeLabel, margin, cursorY);
  cursorY += 20;
  document.setTextColor(64, 84, 80);
  document.setFontSize(10);
  document.text(
    `Prepared for ${profile.display_name || 'BuddyBudget user'} on ${new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())}.`,
    margin,
    cursorY,
  );
  cursorY += 18;

  autoTable(document, {
    startY: cursorY,
    head: [['Currency', 'Income', 'Expenses', 'Remaining']],
    body: calculateReportTotalsByCurrency(months).map((totals) => [
      totals.currency,
      {
        content: formatSignedReportAmount(totals.income, 'income', totals.currency, locale),
        styles: { fontStyle: 'bold', textColor: incomeColor },
      },
      {
        content: formatSignedReportAmount(totals.expenses, 'expense', totals.currency, locale),
        styles: { fontStyle: 'bold', textColor: expenseColor },
      },
      {
        content: formatMoney(totals.remaining, totals.currency, locale),
        styles: {
          fontStyle: 'bold',
          textColor: totals.remaining < 0 ? expenseColor : incomeColor,
        },
      },
    ]),
    theme: 'grid',
    headStyles: { fillColor: [25, 79, 71], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 6 },
  });
  cursorY = (documentWithTable.lastAutoTable?.finalY ?? cursorY) + 24;

  months.forEach((month) => {
    if (cursorY > pageHeight - 160) {
      document.addPage();
      cursorY = 44;
    }
    const totals = calculateTotals(month.budget_month_items);
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
      formatSignedReportAmount(totals.income, 'income', month.currency_code, locale),
      incomeColor,
    );
    drawTotal(
      'Expenses',
      formatSignedReportAmount(totals.expenses, 'expense', month.currency_code, locale),
      expenseColor,
    );
    drawTotal(
      'Remaining',
      formatMoney(totals.remaining, month.currency_code, locale),
      totals.remaining < 0 ? expenseColor : incomeColor,
    );
    document.setFont('helvetica', 'normal');
    cursorY += 10;
    autoTable(document, {
      startY: cursorY,
      head: [['Item', 'Category', 'Status', 'Amount']],
      body: month.budget_month_items.map((item) => [
        item.name_snapshot,
        item.category_snapshot ?? 'Uncategorised',
        item.is_disabled ? 'Paused' : 'Active',
        {
          content: formatSignedReportAmount(
            Number(item.amount),
            item.item_type,
            month.currency_code,
            locale,
          ),
          styles: {
            fontStyle: 'bold',
            textColor: item.item_type === 'income' ? incomeColor : expenseColor,
          },
        },
      ]),
      theme: 'striped',
      headStyles: { fillColor: [229, 239, 236], textColor: [23, 37, 34] },
      styles: { fontSize: 8.5, cellPadding: 5 },
      columnStyles: { 3: { halign: 'right' } },
    });
    cursorY = (documentWithTable.lastAutoTable?.finalY ?? cursorY) + 24;
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFontSize(8);
    document.setTextColor(109, 125, 121);
    document.text(
      `Paused items are shown for context but excluded from totals.  Page ${page} of ${pageCount}`,
      margin,
      pageHeight - 24,
    );
  }
  document.save(`buddybudget-${filenameRange}.pdf`);
};
