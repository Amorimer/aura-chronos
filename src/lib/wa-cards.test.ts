import { test } from "node:test";
import assert from "node:assert/strict";
import { dayLabel, eventCard, reminderCard, taskCard } from "./wa-cards.ts";

const TODAY = "2026-11-13"; // sexta

test("day labels like the reference: Hoje, Amanhã, dia N de Mês (dia da semana)", () => {
  assert.equal(dayLabel("2026-11-13", TODAY), "Hoje (Sex)");
  assert.equal(dayLabel("2026-11-14", TODAY), "Amanhã (Sáb)");
  assert.equal(dayLabel("2026-11-30", TODAY), "dia 30 de Nov (Seg)");
  assert.equal(dayLabel("2027-06-08", TODAY), "dia 8 de Jun de 2027 (Ter)");
});

test("message to send at 9h: title with the whole message, time, reminder at the time", () => {
  const msg = 'Mandar mensagem para Lineu: "Oi tio. Bom dia. Você vai estar em casa hj pela parte da tarde? Vou aí resolver o seu computador e imprimir o que você pediu pode ser? Por volta de 14/15 hrs vou só almoçar e ir praí ok"';
  const c = eventCard({ title: msg, all_day: false, start: "2026-11-14T09:00", end: "2026-11-14T09:15", remind_minutes: 0 }, TODAY);
  assert.equal(c, `💻 *${msg}* Adicionado\n• Data: Amanhã (Sáb)\n• Horário: 09:00 às 09:15\n• Aviso: No momento do evento`);
});

test("whole month, every day, with the user's link in the notes", () => {
  const c = eventCard({
    title: "Colocar o Todoist no site do Amorimer", all_day: true, start: "2027-09-01", end: "2027-09-01",
    recurrence: "daily", recurrence_until: "2027-09-30", remind_at_time: "09:00",
    notes: "https://app.todoist.com/app/notifications",
  }, TODAY);
  assert.equal(c, "📅 *Colocar o Todoist no site do Amorimer* Adicionado\n• Data: a partir de dia 1 de Set de 2027 (Qua) 🔁 todos os dias, termina no dia 30 de Set de 2027 (Qui)\n• Horário: Todo o dia\n• Aviso: 09:00, no mesmo dia\n• Notas: https://app.todoist.com/app/notifications");
});

test("tomorrow's art: title, date, time, reminder; notes only when the user wrote some", () => {
  const c = eventCard({ title: "Fazer a arte do Business Eye 360", all_day: false, start: "2026-11-14T09:00", end: "2026-11-14T10:00", remind_minutes: 30, notes: null }, TODAY);
  assert.equal(c, "🖌️ *Fazer a arte do Business Eye 360* Adicionado\n• Data: Amanhã (Sáb)\n• Horário: 09:00 às 10:00\n• Aviso: 30 min antes");
});

test("tasks and reminders", () => {
  assert.equal(taskCard({ title: "Cobrar R$78 de Sineu", due: "2026-11-16T09:00", priority: "normal" }, TODAY),
    "💰 *Cobrar R$78 de Sineu* Adicionada\n• Tipo: Tarefa\n• Data: dia 16 de Nov (Seg)\n• Horário: 09:00\n• Aviso: No horário do prazo");
  assert.equal(reminderCard({ title: "Tomar remédio", at: "2026-11-13T22:00", recurrence: "daily" }, TODAY),
    "⏰ *Tomar remédio* Adicionado\n• Tipo: Lembrete\n• Data: a partir de Hoje (Sex) 🔁 todos os dias\n• Horário: 22:00\n• Aviso: No momento do lembrete");
});
