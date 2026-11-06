import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCategory, monthRange, parseAmount, shiftMonth, summarize } from "./finance.ts";

test("equivalent categories are merged", () => {
  for (const s of ["Uber", "táxi", "99", "corrida de taxi", "gasolina"]) assert.equal(canonicalCategory(s), "Transporte", s);
  assert.equal(canonicalCategory("supermercado"), "Mercado");
  assert.equal(canonicalCategory("drogaria"), "Farmácia");
  assert.equal(canonicalCategory("FARMACIA"), "Farmácia");
  assert.equal(canonicalCategory("hortifruti"), "Feira");
  assert.equal(canonicalCategory("", [], "almoço no restaurante"), "Alimentação fora");
  assert.equal(canonicalCategory(null), "Outros");
});

test("the user's own category names win, ignoring accents and case", () => {
  assert.equal(canonicalCategory("pet shop", ["Pet shop"]), "Pet shop");
  assert.equal(canonicalCategory("farmácia", ["Farmacia"]), "Farmacia");
  assert.equal(canonicalCategory("  academia de luta  "), "Saúde");
  assert.equal(canonicalCategory("Presentes de natal"), "Presentes de natal");
});

test("amounts typed the Brazilian or the US way", () => {
  const cases: [string, number | null][] = [["52,90", 52.9], ["R$ 1.234,56", 1234.56], ["1234.56", 1234.56], ["1.234", 1234], ["12", 12], ["0,5", 0.5], ["-10", null], ["abc", null], ["1,234.50", 1234.5]];
  for (const [s, v] of cases) assert.equal(parseAmount(s), v, s);
  assert.equal(parseAmount(19.999), 20);
});

test("months and totals", () => {
  assert.deepEqual(monthRange("2026-12"), { start: "2026-12-01", end: "2027-01-01" });
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  const s = summarize(
    [{ amount: 10, category: "Mercado", status: "confirmado" }, { amount: 5.5, category: "Transporte", status: "pendente" }, { amount: 20, category: "Mercado", status: "confirmado" }],
    [{ amount: 100 }],
  );
  assert.deepEqual(s, { income: 100, spent: 35.5, balance: 64.5, pending: 1, categories: [{ name: "Mercado", total: 30, count: 2 }, { name: "Transporte", total: 5.5, count: 1 }] });
});
