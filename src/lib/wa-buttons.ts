// Button ids for WhatsApp reminders and the morning brief. Pure, so it can be unit tested.
// A button id is "act:<verb>:<kind>:<uuid>" or "act:day".
//   kind: e = event, t = task, r = standalone reminder
//   verb: done (Concluído), snooze (Adiar → shows next/pick), next (Próximo dia),
//         pick (Outra data → next message is the new date), item (a row picked in "Ver o dia")
export type WaButton = { id: string; title: string };

export type Kind = "e" | "t" | "r";
export type Action =
  | { verb: "day" }
  | { verb: "done" | "snooze" | "next" | "pick" | "item"; kind: Kind; id: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RE = new RegExp(`^act:(done|snooze|next|pick|item):([etr]):(${UUID})$`);

export function parseAction(id: string | undefined | null): Action | null {
  if (!id) return null;
  if (id === "act:day") return { verb: "day" };
  const m = RE.exec(id);
  return m ? { verb: m[1] as "done", kind: m[2] as Kind, id: m[3] } : null;
}

/** "e:<uuid>" from the dispatcher → kind and id. */
export function parseRef(ref: string | null | undefined): { kind: Kind; id: string } | null {
  const m = ref ? new RegExp(`^([etr]):(${UUID})$`).exec(ref) : null;
  return m ? { kind: m[1] as Kind, id: m[2] } : null;
}

export const doneButton = (kind: Kind, id: string): WaButton => ({ id: `act:done:${kind}:${id}`, title: "✅ Concluído" });
export const snoozeButton = (kind: Kind, id: string): WaButton => ({ id: `act:snooze:${kind}:${id}`, title: "⏰ Adiar" });
export const dayButton: WaButton = { id: "act:day", title: "📋 Ver o dia" };

/** Buttons for a notice: the item it is about (Concluído, Adiar) and, with open tasks, the whole day. */
export function noticeButtons(ref: string | null | undefined, brief?: { events: number; tasks: number } | null): WaButton[] {
  const r = parseRef(ref);
  const out: WaButton[] = [];
  if (r) out.push(doneButton(r.kind, r.id), snoozeButton(r.kind, r.id));
  if (brief && (brief.tasks > 0 || brief.events > 1)) out.push(dayButton);
  return out;
}
