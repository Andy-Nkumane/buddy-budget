import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  normalizeCsvRows,
  parseCsvText,
  suggestCsvMapping,
  type CsvDelimiter,
} from '../../features/transactions/import/csvParser';

const seed = 13_020_001;
const delimiters: Record<CsvDelimiter, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const cell = fc.string({ maxLength: 32 }).filter((value) => !/[\r\n]/.test(value));

describe('CSV parser properties', () => {
  it('preserves bounded quoted Unicode cells for every supported delimiter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<CsvDelimiter>('comma', 'semicolon', 'tab', 'pipe'),
        fc.array(fc.tuple(cell, cell), { minLength: 1, maxLength: 20 }),
        (delimiterName, rows) => {
          const delimiter = delimiters[delimiterName];
          const csv = [
            ['Date', 'Description'].map(quote).join(delimiter),
            ...rows.map((row) => row.map(quote).join(delimiter)),
          ].join('\n');
          const parsed = parseCsvText(csv);
          expect(parsed.delimiter).toBe(delimiterName);
          expect(parsed.rows.map((row) => row.values)).toEqual(rows);
        },
      ),
      { seed, numRuns: 120 },
    );
  });

  it('never treats spreadsheet formula prefixes as monetary values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('=', '+', '@'),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (prefix, suffix) => {
          const table = parseCsvText(
            `Date,Description,Amount\n2026-09-01,Generated,${quote(`${prefix}${suffix}`)}`,
          );
          const [row] = await normalizeCsvRows(
            table,
            suggestCsvMapping(table),
            '2026-09-01',
            '00000000-0000-0000-0000-000000000001',
          );
          expect(row.status).toBe('invalid');
          expect(row.normalized).toBeUndefined();
        },
      ),
      { seed: seed + 1, numRuns: 80 },
    );
  });
});
