import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { occurrencesBetween } from "./data";
import { conflictsWith } from "./recurrence";
import { addDaysToDate, dayRange, fmtDateTime, localToUtc, toLocalDate, toLocalDateTime } from "./time";
import type { EventRow, TaskRow } from "./types";

type Ctx = { supabase: SupabaseClient; userId: string; tz: string; source: "chat" | "image" | "voice" };

const recurrence = z.enum(["daily", "weekly", "monthly", "yearly"]).nullish()
  .describe("Repetição: daily, weekly, monthly ou yearly. Omitir se não repete.");
const localDT = z.string().describe('Data e hora LOCAIS do usuário, formato "YYYY-MM-DDTHH:mm". Para dia inteiro, "YYYY-MM-DD".');

function present(e: EventRow, tz: string) {
  return {
    id: e.id, title: e.title, location: e.location, notes: e.notes, all_day: e.all_day,
    start: e.all_day ? toLocalDate(new Date(e.start_at), tz) : toLocalDateTime(new Date(e.start_at), tz),
    end: e.all_day ? toLocalDate(new Date(e.end_at), tz) : toLocalDateTime(new Date(e.end_at), tz),
    when: e.all_day ? toLocalDate(new Date(e.start_at), tz) : fmtDateTime(new Date(e.start_at), tz),
    recurrence: e.recurrence, recurrence_until: e.recurrence_until,
    remind_minutes: e.remind_minutes, important: e.important,
  };
}
function presentTask(t: TaskRow, tz: string) {
  return {
    id: t.id, title: t.title, notes: t.notes, priority: t.priority, done: !!t.done_at,
    due: t.due_at ? toLocalDateTime(new Date(t.due_at), tz) : null,
    when: t.due_at ? fmtDateTime(new Date(t.due_at), tz) : null,
  };
}

function eventTimes(start: string, end: string | null | undefined, allDay: boolean, tz: string) {
  if (allDay) {
    const day = start.slice(0, 10);
    const lastDay = (end ?? day).slice(0, 10);
    return { start_at: localToUtc(day, tz), end_at: localToUtc(addDaysToDate(lastDay, 1), tz) };
  }
  const s = localToUtc(start, tz);
  const e = end ? localToUtc(end, tz) : new Date(s.getTime() + 60 * 60000);
  return { start_at: s, end_at: e < s ? new Date(s.getTime() + 60 * 60000) : e };
}

async function findConflicts(ctx: Ctx, start: Date, end: Date, id?: string) {
  const occ = await occurrencesBetween(ctx.supabase, new Date(start.getTime() - 86400000), new Date(end.getTime() + 86400000), ctx.tz);
  return conflictsWith({ start, end, id }, occ).map((o) => ({
    id: o.id, title: o.title, when: fmtDateTime(new Date(o.occurrence_start), ctx.tz),
  }));
}

export function buildTools(ctx: Ctx) {
  const { supabase, tz } = ctx;
  return {
    list_agenda: tool({
      description: "Lista compromissos (já expandindo repetições) e tarefas com prazo entre duas datas locais. Use para responder 'como está meu dia/semana', checar horários livres, ou achar um evento para editar.",
      inputSchema: z.object({
        from_date: z.string().describe("YYYY-MM-DD local, inclusivo"),
        to_date: z.string().describe("YYYY-MM-DD local, inclusivo"),
      }),
      execute: async ({ from_date, to_date }) => {
        const { from } = dayRange(from_date, tz);
        const { to } = dayRange(to_date, tz);
        const occ = await occurrencesBetween(supabase, from, to, tz);
        const { data: tasks } = await supabase.from("tasks").select("*").is("done_at", null)
          .gte("due_at", from.toISOString()).lt("due_at", to.toISOString()).order("due_at");
        return {
          events: occ.map((o) => ({
            ...present({ ...o, start_at: o.occurrence_start, end_at: o.occurrence_end }, tz),
          })),
          tasks_due: (tasks as TaskRow[] | null ?? []).map((t) => presentTask(t, tz)),
        };
      },
    }),

    find_events: tool({
      description: "Procura eventos pelo título (texto parcial). Retorna id para editar ou excluir.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const { data, error } = await supabase.from("events").select("*")
          .ilike("title", `%${query.replace(/[%_]/g, "")}%`).order("start_at", { ascending: false }).limit(15);
        if (error) return { error: error.message };
        return { events: (data as EventRow[]).map((e) => present(e, tz)) };
      },
    }),

    create_event: tool({
      description: "Cria um compromisso na agenda. Use para qualquer coisa com dia e hora (reuniões, consultas, voos, aniversários). Retorna conflitos de horário, se houver.",
      inputSchema: z.object({
        title: z.string().min(1).max(300),
        start: localDT,
        end: localDT.nullish().describe("Fim local. Se omitido: 1 hora depois (ou o mesmo dia, se dia inteiro)."),
        all_day: z.boolean().nullish(),
        location: z.string().nullish(),
        notes: z.string().nullish(),
        recurrence,
        recurrence_until: z.string().nullish().describe("YYYY-MM-DD local, último dia da repetição"),
        remind_minutes: z.number().int().min(0).max(10080).nullish()
          .describe("Minutos antes para lembrar. Padrão 30 para eventos com hora; 0 = na hora."),
        important: z.boolean().nullish().describe("Marcar quando o usuário pede para ser chamado/insistido ('me liga', 'não posso esquecer')."),
      }),
      execute: async (input) => {
        const allDay = !!input.all_day || input.start.length === 10;
        const t = eventTimes(input.start, input.end, allDay, tz);
        const { data, error } = await supabase.from("events").insert({
          title: input.title, location: input.location ?? null, notes: input.notes ?? null,
          start_at: t.start_at.toISOString(), end_at: t.end_at.toISOString(), all_day: allDay,
          recurrence: input.recurrence ?? null, recurrence_until: input.recurrence_until ?? null,
          remind_minutes: input.remind_minutes === undefined ? (allDay ? null : 30) : input.remind_minutes,
          important: !!input.important, source: ctx.source,
        }).select().single();
        if (error) return { error: error.message };
        const conflicts = allDay ? [] : await findConflicts(ctx, t.start_at, t.end_at, data.id);
        return { event: present(data as EventRow, tz), conflicts };
      },
    }),

    update_event: tool({
      description: "Altera um compromisso existente (precisa do id; use find_events ou list_agenda antes). Envie só os campos que mudam.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).nullish(),
        start: localDT.nullish(),
        end: localDT.nullish(),
        all_day: z.boolean().nullish(),
        location: z.string().nullish(),
        notes: z.string().nullish(),
        recurrence: z.enum(["daily", "weekly", "monthly", "yearly", "none"]).nullish(),
        recurrence_until: z.string().nullish(),
        remind_minutes: z.number().int().min(-1).max(10080).nullish().describe("-1 remove o lembrete"),
        important: z.boolean().nullish(),
      }),
      execute: async (input) => {
        const { data: cur, error: e1 } = await supabase.from("events").select("*").eq("id", input.id).single();
        if (e1 || !cur) return { error: "evento não encontrado" };
        const old = cur as EventRow;
        const patch: Record<string, unknown> = {};
        if (input.title) patch.title = input.title;
        if (input.location !== undefined && input.location !== null) patch.location = input.location || null;
        if (input.notes !== undefined && input.notes !== null) patch.notes = input.notes || null;
        if (input.recurrence) patch.recurrence = input.recurrence === "none" ? null : input.recurrence;
        if (input.recurrence_until) patch.recurrence_until = input.recurrence_until;
        if (input.remind_minutes !== undefined && input.remind_minutes !== null)
          patch.remind_minutes = input.remind_minutes < 0 ? null : input.remind_minutes;
        if (input.important !== undefined && input.important !== null) patch.important = input.important;
        if (input.start || input.end || input.all_day != null) {
          const allDay = input.all_day ?? old.all_day;
          const dur = new Date(old.end_at).getTime() - new Date(old.start_at).getTime();
          const startLocal = input.start ?? (allDay ? toLocalDate(new Date(old.start_at), tz) : toLocalDateTime(new Date(old.start_at), tz));
          let endLocal = input.end ?? null;
          if (!endLocal && !allDay) {
            endLocal = toLocalDateTime(new Date(localToUtc(startLocal, tz).getTime() + (old.all_day ? 3600000 : dur)), tz);
          }
          const t = eventTimes(startLocal, endLocal, allDay, tz);
          patch.start_at = t.start_at.toISOString();
          patch.end_at = t.end_at.toISOString();
          patch.all_day = allDay;
        }
        const { data, error } = await supabase.from("events").update(patch).eq("id", input.id).select().single();
        if (error) return { error: error.message };
        const ev = data as EventRow;
        const conflicts = ev.all_day ? [] : await findConflicts(ctx, new Date(ev.start_at), new Date(ev.end_at), ev.id);
        return { event: present(ev, tz), conflicts };
      },
    }),

    delete_event: tool({
      description: "Exclui um compromisso (e todas as repetições). Precisa do id.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { data, error } = await supabase.from("events").delete().eq("id", id).select("id,title").single();
        if (error) return { error: "não encontrado" };
        return { deleted: data };
      },
    }),

    create_task: tool({
      description: "Cria uma tarefa (to-do). Use para coisas a fazer sem horário marcado, ou com prazo ('pagar boleto até sexta').",
      inputSchema: z.object({
        title: z.string().min(1).max(300),
        due: localDT.nullish().describe("Prazo local opcional. Se só tiver o dia, use 09:00."),
        priority: z.enum(["low", "normal", "high"]).nullish(),
        notes: z.string().nullish(),
      }),
      execute: async (input) => {
        const due = input.due ? localToUtc(input.due.length === 10 ? `${input.due}T09:00` : input.due, tz) : null;
        const { data, error } = await supabase.from("tasks").insert({
          title: input.title, notes: input.notes ?? null, priority: input.priority ?? "normal",
          due_at: due?.toISOString() ?? null,
        }).select().single();
        if (error) return { error: error.message };
        return { task: presentTask(data as TaskRow, tz) };
      },
    }),

    list_tasks: tool({
      description: "Lista tarefas. Por padrão só as abertas.",
      inputSchema: z.object({ include_done: z.boolean().nullish(), query: z.string().nullish() }),
      execute: async ({ include_done, query }) => {
        let q = supabase.from("tasks").select("*").order("done_at", { nullsFirst: true }).order("due_at", { nullsFirst: false }).limit(50);
        if (!include_done) q = q.is("done_at", null);
        if (query) q = q.ilike("title", `%${query.replace(/[%_]/g, "")}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { tasks: (data as TaskRow[]).map((t) => presentTask(t, tz)) };
      },
    }),

    update_task: tool({
      description: "Altera ou conclui uma tarefa (precisa do id; use list_tasks antes).",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).nullish(),
        due: localDT.nullish().describe('Novo prazo local, ou "none" para remover'),
        done: z.boolean().nullish(),
        priority: z.enum(["low", "normal", "high"]).nullish(),
      }),
      execute: async (input) => {
        const patch: Record<string, unknown> = {};
        if (input.title) patch.title = input.title;
        if (input.priority) patch.priority = input.priority;
        if (input.done != null) patch.done_at = input.done ? new Date().toISOString() : null;
        if (input.due) patch.due_at = input.due === "none" ? null
          : localToUtc(input.due.length === 10 ? `${input.due}T09:00` : input.due, tz).toISOString();
        const { data, error } = await supabase.from("tasks").update(patch).eq("id", input.id).select().single();
        if (error) return { error: "tarefa não encontrada" };
        return { task: presentTask(data as TaskRow, tz) };
      },
    }),

    delete_task: tool({
      description: "Exclui uma tarefa.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id,title").single();
        if (error) return { error: "não encontrada" };
        return { deleted: data };
      },
    }),

    create_note: tool({
      description: "Salva uma nota (ideias, anotações de reunião, listas, informações para lembrar depois, como o número de um pedido).",
      inputSchema: z.object({ title: z.string().max(300), body: z.string().max(20000) }),
      execute: async ({ title, body }) => {
        const { data, error } = await supabase.from("notes").insert({ title, body }).select("id,title,body").single();
        if (error) return { error: error.message };
        return { note: data };
      },
    }),

    find_notes: tool({
      description: "Procura notas por texto no título ou conteúdo.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const q = query.replace(/[%_,()]/g, "");
        const { data, error } = await supabase.from("notes").select("id,title,body,updated_at")
          .or(`title.ilike.%${q}%,body.ilike.%${q}%`).order("updated_at", { ascending: false }).limit(10);
        if (error) return { error: error.message };
        return { notes: data };
      },
    }),

    update_note: tool({
      description: "Altera uma nota existente (substitui título e/ou conteúdo).",
      inputSchema: z.object({ id: z.string().uuid(), title: z.string().max(300).nullish(), body: z.string().max(20000).nullish() }),
      execute: async ({ id, title, body }) => {
        const patch: Record<string, string> = {};
        if (title != null) patch.title = title;
        if (body != null) patch.body = body;
        const { data, error } = await supabase.from("notes").update(patch).eq("id", id).select("id,title,body").single();
        if (error) return { error: "nota não encontrada" };
        return { note: data };
      },
    }),

    create_reminder: tool({
      description: "Cria um lembrete simples por notificação, sem ocupar a agenda ('me lembra de tomar o remédio às 22h todo dia').",
      inputSchema: z.object({ title: z.string().min(1).max(300), at: localDT, recurrence, urgent: z.boolean().nullish() }),
      execute: async ({ title, at, recurrence, urgent }) => {
        let when = localToUtc(at.length === 10 ? `${at}T09:00` : at, tz);
        if (recurrence) {
          const step = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[recurrence] * 86400000;
          while (when.getTime() <= Date.now()) when = new Date(when.getTime() + step);
        } else if (when.getTime() <= Date.now()) {
          return { error: "esse horário já passou" };
        }
        const { data, error } = await supabase.from("reminders").insert({
          title, remind_at: when.toISOString(), recurrence: recurrence ?? null, urgent: !!urgent,
        }).select("id,title,remind_at,recurrence").single();
        if (error) return { error: error.message };
        return { reminder: { ...data, when: fmtDateTime(new Date(data.remind_at), tz) } };
      },
    }),

    list_reminders: tool({
      description: "Lista lembretes pendentes (inclui os de eventos e tarefas).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase.from("reminders").select("id,title,remind_at,recurrence,event_id,task_id")
          .is("sent_at", null).order("remind_at").limit(50);
        if (error) return { error: error.message };
        return { reminders: data.map((r) => ({ ...r, when: fmtDateTime(new Date(r.remind_at), tz) })) };
      },
    }),

    cancel_reminder: tool({
      description: "Cancela um lembrete pendente (precisa do id; use list_reminders).",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { data, error } = await supabase.from("reminders").update({ sent_at: new Date().toISOString() })
          .eq("id", id).is("sent_at", null).select("id,title").single();
        if (error) return { error: "não encontrado" };
        return { cancelled: data };
      },
    }),

    remember: tool({
      description: "Guarda uma preferência ou fato duradouro sobre o usuário para usar no futuro (ex.: 'prefiro reuniões à tarde', 'meu dentista é o Dr. Paulo'). Não use para compromissos.",
      inputSchema: z.object({ fact: z.string().min(1).max(500) }),
      execute: async ({ fact }) => {
        const { data, error } = await supabase.from("memories").insert({ fact }).select("id,fact").single();
        if (error) return { error: error.message };
        return { memory: data };
      },
    }),

    forget: tool({
      description: "Apaga algo da memória do usuário (precisa do id que aparece na lista de memória do sistema).",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { error } = await supabase.from("memories").delete().eq("id", id);
        return error ? { error: error.message } : { forgotten: id };
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof buildTools>;
