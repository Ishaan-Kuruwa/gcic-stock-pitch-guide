import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('Team Alpha')).toBe('Team Alpha');
    expect(csvCell(3)).toBe('3');
  });

  it('writes empty cells for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks, doubling quotes', () => {
    expect(csvCell('Ada, Ben')).toBe('"Ada, Ben"');
    expect(csvCell('The "Bulls"')).toBe('"The ""Bulls"""');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
  });

  it('stops spreadsheet formulas from running', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
  });

  it('leaves formula characters alone in the middle of text', () => {
    expect(csvCell('A=B')).toBe('A=B');
  });
});

describe('toCsv', () => {
  it('starts with a byte order mark and ends every row with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c,d', null]])).toBe('﻿a,b\r\n"c,d",\r\n');
  });
});
