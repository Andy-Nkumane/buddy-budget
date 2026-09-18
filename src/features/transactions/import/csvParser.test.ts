import { describe, expect, it } from 'vitest';
import malformed from './__fixtures__/malformed.csv?raw';
import formula from './__fixtures__/formula.csv?raw';
import quoted from './__fixtures__/quoted-comma.csv?raw';
import semicolon from './__fixtures__/semicolon-decimal-comma.csv?raw';
import { normalizeCsvRows, parseCsvText, suggestCsvMapping } from './csvParser';

const userId = '00000000-0000-0000-0000-000000000001';
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: (_algorithm: string, data: ArrayBuffer) => {
        const source = new Uint8Array(data);
        const checksum = source.reduce((sum, byte, index) => (sum + byte * (index + 1)) % 256, 0);
        return Promise.resolve(
          Uint8Array.from({ length: 32 }, (_, index) => (checksum + index) % 256).buffer,
        );
      },
    },
  },
  configurable: true,
});

describe('CSV statement parsing', () => {
  it('parses quoted commas and escaped quotes', () => {
    const table = parseCsvText(quoted);
    expect(table.delimiter).toBe('comma');
    expect(table.rows[0].values[1]).toBe('Coffee, breakfast');
    expect(table.rows[1].values[1]).toBe('Quoted "merchant"');
  });

  it('normalizes debit and credit columns with comma decimals exactly', async () => {
    const table = parseCsvText(semicolon);
    const rows = await normalizeCsvRows(
      table,
      { ...suggestCsvMapping(table), dateFormat: 'dmy', decimalFormat: 'comma' },
      '2026-09-01',
      userId,
    );
    expect(rows.map((row) => row.normalized?.amount_minor)).toEqual([123456, 2050]);
    expect(rows.map((row) => row.normalized?.transaction_type)).toEqual(['expense', 'income']);
  });

  it('reports malformed rows instead of skipping them', async () => {
    const table = parseCsvText(malformed);
    const rows = await normalizeCsvRows(table, suggestCsvMapping(table), '2026-09-01', userId);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === 'invalid')).toBe(true);
    expect(rows.flatMap((row) => row.errors)).toEqual(
      expect.arrayContaining([
        'Date is invalid for the selected format.',
        'Description must contain 1 to 160 characters.',
      ]),
    );
  });

  it('gives identical-looking legitimate rows different occurrence fingerprints', async () => {
    const table = parseCsvText(
      'Date,Description,Amount\n2026-09-01,Coffee,-10\n2026-09-01,Coffee,-10',
    );
    const rows = await normalizeCsvRows(table, suggestCsvMapping(table), '2026-09-01', userId);
    expect(rows[0].normalized?.external_fingerprint).not.toBe(
      rows[1].normalized?.external_fingerprint,
    );
  });

  it('normalizes an optional category column', async () => {
    const table = parseCsvText(
      'Date,Description,Amount,Category\n2026-09-01,Coffee,-10,  Dining  ',
    );
    const rows = await normalizeCsvRows(table, suggestCsvMapping(table), '2026-09-01', userId);
    expect(rows[0].normalized?.category_name).toBe('Dining');
  });

  it('keeps reference formula text inert and rejects formula amounts', async () => {
    const table = parseCsvText(formula);
    const rows = await normalizeCsvRows(table, suggestCsvMapping(table), '2026-09-01', userId);
    expect(rows[0].normalized?.external_reference).toContain('=HYPERLINK');
    expect(rows[1].status).toBe('invalid');
  });

  it('rejects unclosed quoted fields', () => {
    expect(() => parseCsvText('Date,Description\n2026-09-01,"broken')).toThrow(
      'unclosed quoted field',
    );
  });
});
