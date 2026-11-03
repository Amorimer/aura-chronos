import { test } from "node:test";
import assert from "node:assert/strict";
import { param, templateDefinition, templateMessage, TEMPLATES } from "./wa-templates.ts";

const ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";
const item = [{ id: `act:done:e:${ID}`, title: "✅ Concluído" }, { id: `act:snooze:e:${ID}`, title: "⏰ Adiar" }];

test("reminder template carries the item payloads in button order", () => {
  const m = templateMessage("reminder", "Reunião", "Em 30 min\nSala 2", item);
  assert.equal(m.name, "aura_lembrete");
  const btns = m.components.filter((c) => c.type === "button") as { index: string; parameters: { payload: string }[] }[];
  assert.deepEqual(btns.map((b) => [b.index, b.parameters[0].payload]), [["0", item[0].id], ["1", item[1].id]]);
  const body = m.components[0] as { parameters: { text: string }[] };
  assert.equal(body.parameters[1].text, "Em 30 min · Sala 2");
});

test("brief picks the 3-button or the day-only template", () => {
  assert.equal(templateMessage("brief", "x", "2 compromissos.", [...item, { id: "act:day", title: "📋 Ver o dia" }]).name, "aura_resumo");
  const day = templateMessage("brief", "x", "Nenhum compromisso hoje.", [{ id: "act:day", title: "📋 Ver o dia" }]);
  assert.equal(day.name, "aura_resumo_dia");
  assert.equal(day.components.length, 2);
});

test("definitions match their button counts and Meta limits", () => {
  for (const d of Object.values(TEMPLATES)) {
    const def = templateDefinition(d);
    assert.match(def.name, /^[a-z0-9_]+$/);
    assert.equal((d.text.match(/\{\{\d\}\}/g) ?? []).length, d.example.length);
    assert.ok(!/^\{\{|\}\}$/.test(d.text), "no variable at start or end");
    for (const b of d.buttons) assert.ok(b.length <= 25);
  }
  assert.equal(param("a\t\tb      c"), "a · b c");
  assert.equal(param(""), "-");
});
