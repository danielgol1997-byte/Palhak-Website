"use client";

import { useEffect } from "react";

/**
 * Makes every <table> in the app readable on phones without touching the
 * feature code: it copies each header's text into `data-label` on the matching
 * cells, and globals.css turns rows into stacked cards below 768px using
 * `td::before { content: attr(data-label) }`.
 *
 * Opt a table out with `data-mobile="scroll"` (keeps horizontal scrolling).
 */
function labelTable(table: HTMLTableElement) {
  if (table.dataset.mobile === "scroll") return;
  const headerRow = table.tHead?.rows[0];
  if (!headerRow) return;

  // Expand header cells by colSpan so td index -> label is correct.
  const labels: string[] = [];
  for (const th of Array.from(headerRow.cells)) {
    const text =
      th.dataset.mobileLabel ??
      (th.textContent ?? "").replace(/[▲▼↕↑↓]/g, "").replace(/\s+/g, " ").trim();
    // Header cells with no text (checkbox / icon only) produce no label.
    const span = Math.max(1, th.colSpan || 1);
    for (let i = 0; i < span; i++) labels.push(text);
  }

  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      // Skip nested tables' rows: they are labelled by their own table.
      if (row.closest("table") !== table) continue;
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const span = Math.max(1, cell.colSpan || 1);
        if (span === 1) {
          const label = labels[col] ?? "";
          if (label) {
            if (cell.dataset.label !== label) cell.dataset.label = label;
          } else if (cell.dataset.label !== undefined) {
            delete cell.dataset.label;
          }
        }
        col += span;
      }
    }
  }
  table.dataset.mobileReady = "1";
}

function labelAll(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>("table").forEach(labelTable);
}

export function MobileTableEnhancer() {
  useEffect(() => {
    const root = document.body;
    labelAll(root);
    let scheduled = false;
    const obs = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        labelAll(root);
      });
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
