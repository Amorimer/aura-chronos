// Confirmation cards sent on WhatsApp after the assistant saves something.
// Built from what was actually saved (not from the model's wording), so title, date, time,
// reminder and the user's own notes always come out complete. Pure: unit tested.

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MON = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const REC: Record<string, string> = { daily: "todos os dias", weekly: "toda semana", monthly: "todo mês", yearly: "todo ano" };

/** "2026-11-14" relative to today → "Amanhã (Sáb)", "Hoje (Sex)" or "dia 8 de Jun (Dom)". */
export function dayLabel(day: string, today: string) {
  const [y, m, d] = day.split("-").map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (diff === 0) return `Hoje (${dow})`;
  if (diff === 1) return `Amanhã (${dow})`;
  const year = y !== Number(today.slice(0, 4)) ? ` de ${y}` : "";
  return `dia ${d} de ${MON[m - 1]}${year} (${dow})`;
}

function minutesLabel(min: number) {
  if (min === 0) return "No momento do evento";
  if (min % 1440 === 0) return `${min / 1440} dia${min / 1440 > 1 ? "s" : ""} antes`;
  if (min % 60 === 0) return `${min / 60} h antes`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min antes`;
  return `${min} min antes`;
}

const EMOJI: [RegExp, string][] = [
  [/computador|notebook|pc\b|impressora|imprimir/i, "💻"],
  [/\barte\b|design|logo|desenh|ilustra|pintar/i, "🖌️"],
  [/mensagem|whats|responder|mandar msg/i, "💬"],
  [/ligar|ligação|telefonar/i, "📞"],
  [/m[eé]dic|consulta|dentista|exame|postinho|hospital/i, "🩺"],
  [/anivers[aá]rio/i, "🎂"],
  [/reuni[aã]o|call|meet/i, "👥"],
  [/voo|viagem|aeroporto|passagem/i, "✈️"],
  [/pagar|boleto|conta de|cobrar|fatura|pix/i, "💰"],
  [/academia|treino|corrida/i, "🏋️"],
];
export function emojiFor(title: string, fallback: string) {
  return EMOJI.find(([re]) => re.test(title))?.[1] ?? fallback;
}

export type EventCard = {
  title: string; all_day: boolean; start: string; end: string; location?: string | null; notes?: string | null;
  recurrence?: string | null; recurrence_until?: string | null; remind_minutes?: number | null; important?: boolean;
  /** For all-day events the reminder is a separate notice at a time of day, e.g. "09:00". */
  remind_at_time?: string | null;
};

export function eventCard(e: EventCard, today: string, verb = "Adicionado") {
  const day = e.start.slice(0, 10);
  let data = dayLabel(day, today);
  if (e.recurrence) {
    data = `a partir de ${dayLabel(day, today).replace(/^(Hoje|Amanhã)/, (w) => w.toLowerCase())} 🔁 ${REC[e.recurrence] ?? e.recurrence}`;
    if (e.recurrence_until) data += `, termina no ${dayLabel(e.recurrence_until, today)}`;
  } else if (e.all_day && e.end.slice(0, 10) > day) {
    data = `${dayLabel(day, today)} até ${dayLabel(e.end.slice(0, 10), today)}`;
  }
  const time = e.all_day ? "Todo o dia" : `${e.start.slice(11, 16)}${e.end && e.end.slice(0, 10) === day && e.end.slice(11, 16) !== e.start.slice(11, 16) ? ` às ${e.end.slice(11, 16)}` : ""}`;
  const aviso = e.all_day
    ? (e.remind_at_time ? `${e.remind_at_time}, no mesmo dia` : "Sem aviso")
    : e.remind_minutes == null ? "Sem aviso" : minutesLabel(e.remind_minutes);
  return card(emojiFor(e.title, "📅"), e.title, verb, [
    ["Data", data], ["Horário", time], ["Aviso", aviso + (e.important ? " · alerta insistente" : "")],
    ["Local", e.location], ["Notas", e.notes],
  ]);
}

export type TaskCard = { title: string; due?: string | null; notes?: string | null; priority?: string | null };
export function taskCard(t: TaskCard, today: string, verb = "Adicionada") {
  return card(emojiFor(t.title, "✅"), t.title, verb, [
    ["Tipo", "Tarefa"],
    ["Data", t.due ? dayLabel(t.due.slice(0, 10), today) : "Sem prazo"],
    ["Horário", t.due && t.due.length > 10 ? t.due.slice(11, 16) : null],
    ["Aviso", t.due ? "No horário do prazo" : null],
    ["Prioridade", t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : null],
    ["Notas", t.notes],
  ]);
}

export type ReminderCard = { title: string; at: string; recurrence?: string | null };
export function reminderCard(r: ReminderCard, today: string) {
  const day = dayLabel(r.at.slice(0, 10), today);
  return card(emojiFor(r.title, "⏰"), r.title, "Adicionado", [
    ["Tipo", "Lembrete"],
    ["Data", r.recurrence ? `a partir de ${day} 🔁 ${REC[r.recurrence] ?? r.recurrence}` : day],
    ["Horário", r.at.slice(11, 16)],
    ["Aviso", "No momento do lembrete"],
  ]);
}

function card(emoji: string, title: string, verb: string, rows: [string, string | null | undefined][]) {
  const lines = rows.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `• ${k}: ${String(v).trim()}`);
  return `${emoji} *${title.replace(/\*/g, "")}* ${verb}\n${lines.join("\n")}`;
}
