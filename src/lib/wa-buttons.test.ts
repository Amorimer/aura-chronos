import { test } from "node:test";
import assert from "node:assert/strict";
import { noticeButtons, parseAction, parseRef } from "./wa-buttons.ts";

const ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b";

test("button ids round-trip", () => {
  assert.deepEqual(parseAction(`act:done:e:${ID}`), { verb: "done", kind: "e", id: ID });
  assert.deepEqual(parseAction(`act:next:t:${ID}`), { verb: "next", kind: "t", id: ID });
  assert.deepEqual(parseAction("act:day"), { verb: "day" });
});

test("anything else is not an action", () => {
  for (const s of ["", "oi", `act:drop:e:${ID}`, `act:done:x:${ID}`, "act:done:e:123", `act:done:e:${ID};drop`]) {
    assert.equal(parseAction(s), null, s);
  }
  assert.equal(parseAction(undefined), null);
  assert.equal(parseRef("e:nope"), null);
});

test("reminder gets Concluído and Adiar; ids fit WhatsApp limits", () => {
  const b = noticeButtons(`e:${ID}`);
  assert.deepEqual(b.map((x) => x.title), ["✅ Concluído", "⏰ Adiar"]);
  for (const x of b) assert.ok(x.title.length <= 20 && x.id.length <= 256);
});

test("brief adds Ver o dia when tasks are open", () => {
  assert.deepEqual(noticeButtons(`e:${ID}`, { events: 2, tasks: 2 }).map((x) => x.id.split(":")[1]), ["done", "snooze", "day"]);
  assert.deepEqual(noticeButtons(null, { events: 0, tasks: 3 }).map((x) => x.title), ["📋 Ver o dia"]);
  assert.deepEqual(noticeButtons(null, { events: 0, tasks: 0 }), []);
});
