import { describe, it, expect } from "vitest";
import { toCsv, type CsvColumn } from "@/lib/csv-export";

interface Row {
  name: string;
  amount: number;
}

const columns: CsvColumn<Row>[] = [
  { key: "name", label: "نام", value: (r) => r.name },
  { key: "amount", label: "مبلغ", value: (r) => r.amount },
];

describe("toCsv", () => {
  it("builds a header row and one row per record", () => {
    const csv = toCsv<Row>([{ name: "علی", amount: 1000 }], columns);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("نام,مبلغ");
    expect(lines[1]).toBe("علی,1000");
  });

  it("quotes fields containing commas or quotes", () => {
    const csv = toCsv<Row>([{ name: 'علی, "رضا"', amount: 5 }], columns);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"علی, ""رضا""",5');
  });

  it("prefixes the output with a BOM for Excel UTF-8 compatibility", () => {
    const csv = toCsv<Row>([], columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
