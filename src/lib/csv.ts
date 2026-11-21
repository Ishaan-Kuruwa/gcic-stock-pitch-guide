/**
 * CSV files for officers to open in Google Sheets or Excel. Pure functions.
 *
 * - Every cell is quoted when it needs to be (comma, quote, line break), with
 *   quotes doubled, per RFC 4180. Rows end with CRLF.
 * - A cell a spreadsheet would run as a formula (it starts with = + - @, a
 *   tab or a carriage return) gets a leading apostrophe, so a team named
 *   "=HYPERLINK(...)" shows as text instead of running.
 * - The file starts with a byte order mark so Excel reads it as UTF-8.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell, made safe to open in a spreadsheet and quoted if needed. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: a header row, then the data rows. */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
