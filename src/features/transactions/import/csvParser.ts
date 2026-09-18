import type { ItemType } from '../../../shared/types/domain';

export const CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 2000;
const CSV_MAX_COLUMNS = 100;

export type CsvDelimiter = 'comma' | 'semicolon' | 'tab' | 'pipe';
export type CsvDateFormat = 'ymd' | 'dmy' | 'mdy';
export type CsvDecimalFormat = 'auto' | 'dot' | 'comma';
export type CsvAmountMode = 'signed' | 'debit_credit';

export type CsvTable = {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: Array<{ line: number; values: string[] }>;
};

export type CsvColumnMapping = {
  dateColumn: number;
  descriptionColumn: number;
  referenceColumn: number | null;
  categoryColumn: number | null;
  amountMode: CsvAmountMode;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  dateFormat: CsvDateFormat;
  decimalFormat: CsvDecimalFormat;
};

export type NormalizedImportRow = {
  transaction_date: string;
  description: string;
  amount_minor: number;
  transaction_type: ItemType;
  external_reference: string | null;
  category_name: string | null;
  external_fingerprint: string;
};

export type CsvPreviewRow = {
  id: string;
  line: number;
  raw: string[];
  normalized?: NormalizedImportRow;
  status: 'valid' | 'invalid' | 'duplicate' | 'excluded';
  errors: string[];
};

const delimiterCharacters: Record<CsvDelimiter, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

const parseWithDelimiter = (
  text: string,
  delimiter: string,
): Array<{ line: number; values: string[] }> => {
  const rows: Array<{ line: number; values: string[] }> = [];
  let values: string[] = [];
  let value = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else {
        value += character;
        if (character === '\n') line += 1;
      }
      continue;
    }
    if (character === '"' && value.length === 0) quoted = true;
    else if (character === delimiter) {
      values.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      values.push(value);
      rows.push({ line: rowLine, values });
      value = '';
      values = [];
      line += 1;
      rowLine = line;
    } else value += character;
  }
  if (quoted) throw new Error(`CSV line ${rowLine} has an unclosed quoted field.`);
  if (value.length || values.length) {
    values.push(value);
    rows.push({ line: rowLine, values });
  }
  return rows;
};

export const parseCsvText = (input: string): CsvTable => {
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('The CSV file is empty.');
  const candidates = (Object.entries(delimiterCharacters) as Array<[CsvDelimiter, string]>).map(
    ([name, delimiter]) => {
      const rows = parseWithDelimiter(text, delimiter);
      const widths = rows.slice(0, 20).map((row) => row.values.length);
      const frequency = new Map<number, number>();
      widths.forEach((width) => frequency.set(width, (frequency.get(width) ?? 0) + 1));
      const [width = 1, matches = 0] =
        [...frequency.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      return { name, rows, score: width > 1 ? matches * width : 0 };
    },
  );
  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  if (!selected || selected.score === 0) throw new Error('No supported CSV delimiter was found.');
  const [headerRow, ...rows] = selected.rows;
  const headers = headerRow.values.map((header, index) => header.trim() || `Column ${index + 1}`);
  if (headers.length > CSV_MAX_COLUMNS)
    throw new Error(`CSV files may contain at most ${CSV_MAX_COLUMNS} columns.`);
  if (rows.length > CSV_MAX_ROWS)
    throw new Error(`CSV files may contain at most ${CSV_MAX_ROWS} data rows.`);
  return { delimiter: selected.name, headers, rows };
};

export const readCsvFile = async (file: File): Promise<CsvTable> => {
  if (file.size > CSV_MAX_BYTES) throw new Error('The CSV file is larger than the 2 MiB limit.');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('The statement must be a valid UTF-8 text file.');
  }
  return parseCsvText(text);
};

const findHeader = (headers: string[], patterns: RegExp[]): number =>
  headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header.trim().toLowerCase())),
  );

export const suggestCsvMapping = (table: CsvTable): CsvColumnMapping => {
  const dateColumn = findHeader(table.headers, [/^date$/, /transaction.*date/, /posting.*date/]);
  const descriptionColumn = findHeader(table.headers, [
    /description/,
    /merchant/,
    /details/,
    /narrative/,
  ]);
  const debitColumn = findHeader(table.headers, [/^debit$/, /withdrawal/, /money out/, /^soll$/]);
  const creditColumn = findHeader(table.headers, [/^credit$/, /deposit/, /money in/, /^haben$/]);
  const amountColumn = findHeader(table.headers, [/^amount$/, /transaction.*amount/]);
  const referenceColumn = findHeader(table.headers, [/reference/, /^ref$/, /transaction.*id/]);
  const categoryColumn = findHeader(table.headers, [/^category$/, /category.*name/, /^type$/]);
  return {
    dateColumn: Math.max(0, dateColumn),
    descriptionColumn: Math.max(0, descriptionColumn),
    referenceColumn: referenceColumn < 0 ? null : referenceColumn,
    categoryColumn: categoryColumn < 0 ? null : categoryColumn,
    amountMode: debitColumn >= 0 && creditColumn >= 0 ? 'debit_credit' : 'signed',
    amountColumn: amountColumn < 0 ? null : amountColumn,
    debitColumn: debitColumn < 0 ? null : debitColumn,
    creditColumn: creditColumn < 0 ? null : creditColumn,
    dateFormat: 'ymd',
    decimalFormat: 'auto',
  };
};

const parseDate = (value: string, format: CsvDateFormat): string | null => {
  const parts = value.trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/);
  if (!parts) return null;
  let year: number;
  let month: number;
  let day: number;
  if (format === 'ymd') [, year, month, day] = parts.map(Number);
  else if (format === 'dmy') [, day, month, year] = parts.map(Number);
  else [, month, day, year] = parts.map(Number);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const parseAmount = (input: string, format: CsvDecimalFormat): number | null => {
  let value = input.trim().replace(/[\s\u00a0']/g, '');
  if (!value) return null;
  if (/^[=+@]/.test(value)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.endsWith('-')) {
    negative = true;
    value = value.slice(0, -1);
  }
  value = value.replace(/^[^\d.,+-]+|[^\d.,+-]+$/g, '');
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith('+')) value = value.slice(1);
  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  let decimal = format === 'dot' ? '.' : format === 'comma' ? ',' : lastComma > lastDot ? ',' : '.';
  if (format === 'auto' && (decimal === '.' ? lastDot : lastComma) < 0) decimal = '.';
  const separatorIndex = value.lastIndexOf(decimal);
  const fractional = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : '';
  const hasDecimal = separatorIndex >= 0 && fractional.length <= 2;
  const wholeSource = hasDecimal ? value.slice(0, separatorIndex) : value;
  if (!/^\d[\d.,]*$/.test(wholeSource) || (hasDecimal && !/^\d{1,2}$/.test(fractional)))
    return null;
  const whole = wholeSource.replace(/[.,]/g, '');
  const minor = Number(whole) * 100 + Number(hasDecimal ? fractional.padEnd(2, '0') : 0);
  if (!Number.isSafeInteger(minor) || minor > 99999999999999) return null;
  return negative ? -minor : minor;
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const normalizeCsvRows = async (
  table: CsvTable,
  mapping: CsvColumnMapping,
  monthStart: string,
  userId: string,
): Promise<CsvPreviewRow[]> => {
  const occurrences = new Map<string, number>();
  return Promise.all(
    table.rows.map(async (row, index) => {
      const errors: string[] = [];
      const date = parseDate(row.values[mapping.dateColumn] ?? '', mapping.dateFormat);
      const description = normalizeText(row.values[mapping.descriptionColumn] ?? '');
      if (!date) errors.push('Date is invalid for the selected format.');
      else if (!date.startsWith(monthStart.slice(0, 7)))
        errors.push('Date is outside the destination month.');
      if (!description || description.length > 160)
        errors.push('Description must contain 1 to 160 characters.');
      let signedAmount: number | null = null;
      if (mapping.amountMode === 'signed') {
        signedAmount =
          mapping.amountColumn === null
            ? null
            : parseAmount(row.values[mapping.amountColumn] ?? '', mapping.decimalFormat);
        if (signedAmount === null || signedAmount === 0)
          errors.push('Signed amount is invalid or zero.');
      } else {
        const debit =
          mapping.debitColumn === null
            ? null
            : parseAmount(row.values[mapping.debitColumn] ?? '', mapping.decimalFormat);
        const credit =
          mapping.creditColumn === null
            ? null
            : parseAmount(row.values[mapping.creditColumn] ?? '', mapping.decimalFormat);
        const debitValue = debit === null ? 0 : Math.abs(debit);
        const creditValue = credit === null ? 0 : Math.abs(credit);
        if (debitValue > 0 === creditValue > 0)
          errors.push('Provide either a debit or a credit amount, not both.');
        else signedAmount = creditValue > 0 ? creditValue : -debitValue;
      }
      const reference =
        mapping.referenceColumn === null
          ? null
          : normalizeText(row.values[mapping.referenceColumn] ?? '') || null;
      const category =
        mapping.categoryColumn === null
          ? null
          : normalizeText(row.values[mapping.categoryColumn] ?? '') || null;
      if (reference && reference.length > 255)
        errors.push('Reference must contain at most 255 characters.');
      if (category && category.length > 60)
        errors.push('Category must contain at most 60 characters.');
      if (errors.length || !date || signedAmount === null || signedAmount === 0) {
        return {
          id: `${row.line}-${index}`,
          line: row.line,
          raw: row.values,
          status: 'invalid' as const,
          errors,
        };
      }
      const transactionType: ItemType = signedAmount < 0 ? 'expense' : 'income';
      const amountMinor = Math.abs(signedAmount);
      const canonical = [
        date,
        transactionType,
        amountMinor,
        description.toLocaleLowerCase('en'),
        reference?.toLocaleLowerCase('en') ?? '',
      ].join('|');
      const occurrence = (occurrences.get(canonical) ?? 0) + 1;
      occurrences.set(canonical, occurrence);
      const fingerprint = await sha256(`${userId}|${canonical}|${occurrence}`);
      return {
        id: `${row.line}-${index}`,
        line: row.line,
        raw: row.values,
        status: 'valid' as const,
        errors,
        normalized: {
          transaction_date: date,
          description,
          amount_minor: amountMinor,
          transaction_type: transactionType,
          external_reference: reference,
          category_name: category,
          external_fingerprint: fingerprint,
        },
      };
    }),
  );
};

export const createImportBatchKey = async (
  userId: string,
  monthId: string,
  accountId: string | null,
  rows: CsvPreviewRow[],
): Promise<string> =>
  sha256(
    [
      userId,
      monthId,
      accountId ?? '',
      ...rows.flatMap((row) => row.normalized?.external_fingerprint ?? []),
    ].join('|'),
  );
