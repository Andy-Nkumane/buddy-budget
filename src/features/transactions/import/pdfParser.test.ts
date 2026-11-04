import { describe, expect, it } from 'vitest';
import { parseSupportedPdfLayout, type PdfTextToken } from './pdfParser';

const line = (y: number, values: Array<[number, string]>): PdfTextToken[] =>
  values.map(([x, text]) => ({ x, y, text }));

describe('PDF statement layout parser', () => {
  it('extracts multi-page debit and credit rows and joins wrapped descriptions', () => {
    const table = parseSupportedPdfLayout([
      [
        ...line(700, [
          [10, 'Date'],
          [90, 'Description'],
          [280, 'Reference'],
          [370, 'Debit'],
          [440, 'Credit'],
          [510, 'Balance'],
        ]),
        ...line(680, [
          [10, '02/11/2026'],
          [90, 'CARD PURCHASE'],
          [280, 'REF-1'],
          [370, '25.50'],
          [510, '1,000.00'],
        ]),
        ...line(665, [[90, 'COFFEE SHOP']]),
      ],
      [
        ...line(700, [
          [10, 'Date'],
          [90, 'Description'],
          [280, 'Reference'],
          [370, 'Debit'],
          [440, 'Credit'],
          [510, 'Balance'],
        ]),
        ...line(680, [
          [10, '03/11/2026'],
          [90, 'SALARY'],
          [280, 'REF-2'],
          [440, '500.00'],
          [510, '1,500.00'],
        ]),
      ],
    ]);

    expect(table.headers).toEqual(['Date', 'Description', 'Reference', 'Debit', 'Credit']);
    expect(table.rows.map((row) => row.values)).toEqual([
      ['02/11/2026', 'CARD PURCHASE COFFEE SHOP', 'REF-1', '25.50', ''],
      ['03/11/2026', 'SALARY', 'REF-2', '', '500.00'],
    ]);
  });

  it('rejects unsupported and image-only layouts', () => {
    expect(() => parseSupportedPdfLayout([[...line(700, [[10, 'Account statement']])]])).toThrow(
      /layout is not supported/i,
    );
    expect(() =>
      parseSupportedPdfLayout([
        line(700, [
          [10, 'Date'],
          [90, 'Description'],
          [370, 'Amount'],
          [510, 'Balance'],
        ]),
      ]),
    ).toThrow(/image-only statements are not supported/i);
  });

  it('accepts common transaction and currency-labelled column headings', () => {
    const table = parseSupportedPdfLayout([
      [
        ...line(700, [
          [10, 'Date'],
          [90, 'Transaction description'],
          [370, 'Debit (R)'],
          [440, 'Credit (R)'],
          [510, 'Balance (R)'],
        ]),
        ...line(680, [
          [10, '2026-11-02'],
          [90, 'SYNTHETIC PURCHASE'],
          [370, '25.50'],
          [440, '-'],
          [510, '974.50'],
        ]),
      ],
    ]);

    expect(table.rows[0].values).toEqual(['2026-11-02', 'SYNTHETIC PURCHASE', '', '25.50', '-']);
  });

  it('does not require an unused running-balance column', () => {
    const table = parseSupportedPdfLayout([
      [
        ...line(700, [
          [10, 'Value date'],
          [90, 'Payee details'],
          [370, 'Amount (ZAR)'],
        ]),
        ...line(680, [
          [10, '2026-11-03'],
          [90, 'SYNTHETIC REFUND'],
          [370, '40.00'],
        ]),
      ],
    ]);

    expect(table.rows[0].values).toEqual(['2026-11-03', 'SYNTHETIC REFUND', '', '40.00']);
  });
});
