// Regression: ISSUE-002 — asterisks from the assistant showed raw in the app chat ("**Aura Cronos**")
// Found by /qa on 2026-10-26
// Report: .gstack/qa-reports/run-20261026T234354Z/qa-report-aura-cronos.vercel.app-2026-10-26.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { boldRuns, toWhatsApp } from "./rich-text.ts";

test("markdown and whatsapp bold both become bold runs", () => {
  assert.deepEqual(boldRuns("Pronto, corrigido para **Aura Cronos**!"), [
    { text: "Pronto, corrigido para ", bold: false },
    { text: "Aura Cronos", bold: true },
    { text: "!", bold: false },
  ]);
  assert.deepEqual(boldRuns("• *Sexta-feira (23/10):*"), [
    { text: "• ", bold: false },
    { text: "Sexta-feira (23/10):", bold: true },
  ]);
});

test("lone asterisks and plain text are left alone", () => {
  assert.deepEqual(boldRuns("5 * 3 = 15"), [{ text: "5 * 3 = 15", bold: false }]);
  assert.deepEqual(boldRuns(""), []);
});

test("whatsapp gets single-asterisk bold", () => {
  assert.equal(toWhatsApp("corrigido para **Aura Cronos** e *ok*"), "corrigido para *Aura Cronos* e *ok*");
});
