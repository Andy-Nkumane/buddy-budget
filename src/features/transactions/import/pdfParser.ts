import type { CsvTable } from './csvParser';

export const PDF_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_PAGES = 50;
const PDF_MAX_TEXT_ITEMS = 20_000;
const PDF_MAX_TEXT_CHARACTERS = 1_000_000;
const PDF_PARSE_TIMEOUT_MS = 15_000;

class PdfImportError extends Error {}

export type PdfTextToken = { text: string; x: number; y: number };

type ColumnName = 'date' | 'description' | 'reference' | 'amount' | 'debit' | 'credit' | 'balance';
type Column = { name: ColumnName; x: number };

const normalizeHeading = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z]/g, '');

const headingName = (value: string): ColumnName | null => {
  const normalized = normalizeHeading(value);
  if (
    normalized === 'date' ||
    normalized === 'transactiondate' ||
    normalized === 'postingdate' ||
    normalized === 'valuedate'
  )
    return 'date';
  if (
    normalized.includes('description') ||
    normalized.includes('details') ||
    normalized.includes('narrative') ||
    normalized.includes('merchant') ||
    normalized.includes('payee') ||
    normalized.includes('particulars')
  )
    return 'description';
  if (normalized === 'ref' || normalized.includes('reference')) return 'reference';
  if (normalized.startsWith('amount') || normalized.startsWith('transactionamount'))
    return 'amount';
  if (
    normalized.startsWith('debit') ||
    normalized.startsWith('withdrawal') ||
    normalized.startsWith('moneyout')
  )
    return 'debit';
  if (
    normalized.startsWith('credit') ||
    normalized.startsWith('deposit') ||
    normalized.startsWith('moneyin')
  )
    return 'credit';
  if (normalized.startsWith('balance') || normalized.startsWith('runningbalance')) return 'balance';
  return null;
};

const groupLines = (tokens: PdfTextToken[]): PdfTextToken[][] => {
  const lines: PdfTextToken[][] = [];
  [...tokens]
    .filter((token) => token.text.trim())
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .forEach((token) => {
      const line = lines.at(-1);
      if (line && Math.abs(line[0].y - token.y) <= 2) line.push(token);
      else lines.push([token]);
    });
  lines.forEach((line) => line.sort((left, right) => left.x - right.x));
  return lines;
};

const findColumns = (line: PdfTextToken[]): Column[] | null => {
  const columns = line.flatMap((token) => {
    const name = headingName(token.text);
    return name ? [{ name, x: token.x }] : [];
  });
  const names = new Set(columns.map((column) => column.name));
  const supported =
    names.has('date') &&
    names.has('description') &&
    (names.has('amount') || (names.has('debit') && names.has('credit')));
  return supported ? columns.sort((left, right) => left.x - right.x) : null;
};

const columnForToken = (token: PdfTextToken, columns: Column[]): ColumnName => {
  let selected = columns[0];
  for (const column of columns) {
    if (token.x >= column.x - 4) selected = column;
    else break;
  }
  return selected.name;
};

const joinValues = (values: string[]): string => values.join(' ').trim().replace(/\s+/g, ' ');

export const parseSupportedPdfLayout = (pages: PdfTextToken[][]): CsvTable => {
  let activeColumns: Column[] | null = null;
  let amountMode: 'signed' | 'debit_credit' | null = null;
  let current: Record<ColumnName, string[]> | null = null;
  const records: Array<Record<ColumnName, string[]>> = [];

  const finishCurrent = () => {
    if (current) records.push(current);
    current = null;
  };

  pages.forEach((page) => {
    groupLines(page).forEach((line) => {
      const detectedColumns = findColumns(line);
      if (detectedColumns) {
        const detectedMode = detectedColumns.some((column) => column.name === 'amount')
          ? 'signed'
          : 'debit_credit';
        if (amountMode && amountMode !== detectedMode)
          throw new PdfImportError(
            'This PDF changes transaction column layouts between pages. Export a CSV instead.',
          );
        activeColumns = detectedColumns;
        amountMode = detectedMode;
        return;
      }
      if (!activeColumns) return;
      const values: Record<ColumnName, string[]> = {
        date: [],
        description: [],
        reference: [],
        amount: [],
        debit: [],
        credit: [],
        balance: [],
      };
      line.forEach((token) =>
        values[columnForToken(token, activeColumns!)].push(token.text.trim()),
      );
      const date = joinValues(values.date);
      const startsTransaction = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(date);
      if (startsTransaction) {
        finishCurrent();
        current = values;
        return;
      }
      if (
        current &&
        !date &&
        !joinValues(values.amount) &&
        !joinValues(values.debit) &&
        !joinValues(values.credit) &&
        (joinValues(values.description) || joinValues(values.reference))
      ) {
        current.description.push(...values.description);
        current.reference.push(...values.reference);
      }
    });
  });
  finishCurrent();

  if (!activeColumns || !amountMode)
    throw new PdfImportError(
      'This PDF layout is not supported. Use a text-based statement with Date, Description, and Amount or Debit/Credit columns.',
    );
  if (!records.length)
    throw new PdfImportError(
      'No transaction rows were found. Scanned or image-only statements are not supported because OCR is unavailable.',
    );

  const headers =
    amountMode === 'signed'
      ? ['Date', 'Description', 'Reference', 'Amount']
      : ['Date', 'Description', 'Reference', 'Debit', 'Credit'];
  return {
    delimiter: 'comma',
    headers,
    rows: records.map((record, index) => ({
      line: index + 1,
      values:
        amountMode === 'signed'
          ? [
              joinValues(record.date),
              joinValues(record.description),
              joinValues(record.reference),
              joinValues(record.amount),
            ]
          : [
              joinValues(record.date),
              joinValues(record.description),
              joinValues(record.reference),
              joinValues(record.debit),
              joinValues(record.credit),
            ],
    })),
  };
};

const withTimeout = async <T>(promise: Promise<T>, message: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new PdfImportError(message)), PDF_PARSE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const readPdfFile = async (file: File): Promise<CsvTable> => {
  if (file.size > PDF_MAX_BYTES)
    throw new PdfImportError('The PDF file is larger than the 5 MiB limit.');
  const data = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder('ascii').decode(data.slice(0, 1024)).includes('%PDF-'))
    throw new PdfImportError('The selected file is not a valid PDF document.');

  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = getDocument({ data, isEvalSupported: false });
  try {
    return await withTimeout(
      (async () => {
        const document = await loadingTask.promise;
        if (document.numPages > PDF_MAX_PAGES)
          throw new PdfImportError(`PDF statements may contain at most ${PDF_MAX_PAGES} pages.`);
        const pages: PdfTextToken[][] = [];
        let itemCount = 0;
        let characterCount = 0;
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const tokens = content.items.flatMap((item) => {
            if (!('str' in item)) return [];
            const text: unknown = item.str;
            const transform: unknown = item.transform;
            if (
              typeof text !== 'string' ||
              !text.trim() ||
              !Array.isArray(transform) ||
              typeof transform[4] !== 'number' ||
              typeof transform[5] !== 'number'
            )
              return [];
            itemCount += 1;
            characterCount += text.length;
            if (itemCount > PDF_MAX_TEXT_ITEMS || characterCount > PDF_MAX_TEXT_CHARACTERS)
              throw new PdfImportError('The PDF contains too much text to import safely.');
            return [{ text, x: transform[4], y: transform[5] }];
          });
          pages.push(tokens);
        }
        return parseSupportedPdfLayout(pages);
      })(),
      'The PDF took too long to read. Try a smaller statement.',
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new PdfImportError(
        'Password-protected PDF statements are not supported. Export an unlocked CSV instead.',
      );
    if (error instanceof PdfImportError) throw error;
    throw new PdfImportError(
      'The PDF statement could not be read. It may be corrupted or use an unsupported layout.',
    );
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
};
