import { describe, expect, it } from 'vitest';
import { escapeCsv } from './download';

describe('CSV escaping', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@IMPORT'])(
    'neutralizes spreadsheet formula input %s',
    (value) => expect(escapeCsv(value)).toBe(`"'${value}"`),
  );

  it('quotes embedded quote characters', () => {
    expect(escapeCsv('A "quoted" name')).toBe('"A ""quoted"" name"');
  });
});
