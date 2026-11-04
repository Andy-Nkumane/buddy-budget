import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(
  projectRoot,
  'e2e/fixtures/synthetic-supported-bank-statement-november-2026.pdf',
);
const document = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

const columns = [
  { label: 'Date', x: 42 },
  { label: 'Transaction description', key: 'description', x: 110 },
  { label: 'Reference', x: 285 },
  { label: 'Debit (R)', key: 'debit', x: 385 },
  { label: 'Credit (R)', key: 'credit', x: 445 },
  { label: 'Balance (R)', key: 'balance', x: 505 },
];

const drawPage = (pageNumber, rows) => {
  document.setFont('helvetica', 'bold');
  document.setFontSize(16);
  document.text('SYNTHETIC BANK STATEMENT — TEST DATA ONLY', 42, 48);
  document.setFontSize(10);
  document.text(`Statement period: 1–30 November 2026 · Page ${pageNumber} of 2`, 42, 68);
  document.setDrawColor(25, 79, 71);
  document.line(42, 78, 553, 78);
  document.setFontSize(9);
  columns.forEach(({ label, x }) => document.text(label, x, 104));
  document.setFont('helvetica', 'normal');
  rows.forEach((row) => {
    columns.forEach(({ label, key, x }) => {
      const value = row[key ?? label.toLowerCase()] ?? '';
      if (value) document.text(value, x, row.y);
    });
    if (row.wrappedDescription) document.text(row.wrappedDescription, columns[1].x, row.y + 13);
  });
  document.setFontSize(8);
  document.text('Fictional values. Not issued by a bank and not financial history.', 42, 800);
};

drawPage(1, [
  {
    y: 130,
    date: '02/11/2026',
    description: 'CARD PURCHASE',
    wrappedDescription: 'COFFEE SHOP',
    reference: 'SYN-001',
    debit: '25.50',
    balance: '974.50',
  },
  {
    y: 172,
    date: '05/11/2026',
    description: 'SALARY',
    reference: 'SYN-002',
    credit: '2500.00',
    balance: '3474.50',
  },
]);

document.addPage();
drawPage(2, [
  {
    y: 130,
    date: '12/11/2026',
    description: 'GROCERY MARKET',
    reference: 'SYN-003',
    debit: '340.75',
    balance: '3133.75',
  },
  {
    y: 159,
    date: '18/11/2026',
    description: 'REFUND',
    reference: 'SYN-004',
    credit: '40.00',
    balance: '3173.75',
  },
]);

await mkdir(dirname(outputPath), { recursive: true });
const pdfBytes = Buffer.from(document.output('arraybuffer'));
await writeFile(outputPath, pdfBytes);

const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false });
const generatedDocument = await loadingTask.promise;
assert.equal(generatedDocument.numPages, 2);
let extractedText = '';
for (let pageNumber = 1; pageNumber <= generatedDocument.numPages; pageNumber += 1) {
  const page = await generatedDocument.getPage(pageNumber);
  const content = await page.getTextContent();
  extractedText += content.items.flatMap((item) => ('str' in item ? item.str : [])).join(' ');
}
for (const expectedText of ['TEST DATA ONLY', 'Debit', 'Credit', 'SYN-001', 'SYN-004'])
  assert.match(extractedText, new RegExp(expectedText));
await loadingTask.destroy();
console.log(`Generated ${outputPath}`);
