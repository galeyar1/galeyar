/**
 * CSV export — opens natively in Excel, so this covers the spec's
 * "Excel/CSV" export option honestly with one implementation instead of
 * pretending to generate a real .xlsx binary.
 */

export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number;
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(","));
  // Leading BOM so Excel opens Persian/UTF-8 text correctly instead of mojibake.
  return "﻿" + [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
