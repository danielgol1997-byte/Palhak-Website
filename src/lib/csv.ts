function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

export function toCsv(rows: Array<Record<string, unknown>>, header: string[]) {
  const lines: string[] = [];
  lines.push(header.map(esc).join(","));
  for (const r of rows) {
    lines.push(header.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}


