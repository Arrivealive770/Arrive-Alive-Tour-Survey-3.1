/**
 * CSV generation for the admin portal's spreadsheet exports.
 *
 * Written by hand rather than pulled from a package: the shape here is a plain
 * table of strings and numbers, and a spreadsheet export is not worth a
 * dependency that has to be kept current on a server that runs at venues.
 */

/**
 * Values that spreadsheet software treats as a formula rather than as text.
 *
 * Venue names, team names and survey questions are all typed in by staff, so a
 * cell can legitimately begin with one of these characters — and Excel, Sheets
 * and Numbers will all try to evaluate it when the file is opened. That is the
 * CSV injection problem: a name like "=HYPERLINK(...)" becomes a live formula
 * in whoever's spreadsheet. Prefixing a single quote makes the cell literal
 * text, which is what it always was.
 */
const FORMULA_LEADERS = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (text.length > 0 && FORMULA_LEADERS.includes(text[0]!)) {
    text = `'${text}`;
  }

  // Quote whenever the delimiter, a quote or a line break is present, doubling
  // any quotes inside. Leading/trailing spaces are quoted too, since they are
  // otherwise trimmed on the way in.
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** A table of rows to CSV text. The first row is normally the header. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/**
 * A CSV response the browser saves as a file.
 *
 * The byte order mark matters: without it Excel on Windows reads the file as
 * the local codepage and mangles any non-ASCII character in a venue name.
 */
export function csvResponse(filename: string, rows: unknown[][]): Response {
  const body = `﻿${toCsv(rows)}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** e.g. "arrive-alive-responses-2026-08-25.csv" — safe on every platform. */
export function timestampedFilename(prefix: string, when: Date): string {
  const stamp = when.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
