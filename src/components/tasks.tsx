"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtDateTime, localToUtc, toLocalDate, toLocalDateTime } from "@/lib/time";
import type { ReminderRow, TaskRow } from "@/lib/types";
import { Field, fieldCls, Sheet } from "./sheet";
import { IconBell, IconCheck, IconRepeat, IconX } from "./icons";

const REC: Record<string, string> = { daily: "todo dia", weekly: "toda semana", monthly: "todo mês", yearly: "todo ano" };

export function Tasks({ tz }: { tz: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [done, setDone] = useState<TaskRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [edit, setEdit] = useState<TaskRow | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [open, closed, rem] = await Promise.all([
      sb.from("tasks").select("*").is("done_at", null).order("due_at", { nullsFirst: false }).order("created_at", { ascending: false }),
      sb.from("tasks").select("*").not("done_at", "is", null).order("done_at", { ascending: false }).limit(30),
      sb.from("reminders").select("*").is("sent_at", null).is("event_id", null).is("task_id", null).order("remind_at"),
    ]);
    setTasks((open.data as TaskRow[]) ?? []);
    setDone((closed.data as TaskRow[]) ?? []);
    setReminders((rem.data as ReminderRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    const { data } = await createClient().from("tasks").insert({ title: t }).select().single();
    if (data) setTasks((cur) => [...cur, data as TaskRow]);
  }

  async function toggle(t: TaskRow) {
    const done_at = t.done_at ? null : new Date().toISOString();
    if (!t.done_at) navigator.vibrate?.(15);
    setTasks((cur) => (done_at ? cur.filter((x) => x.id !== t.id) : [...cur, { ...t, done_at }]));
    setDone((cur) => (done_at ? [{ ...t, done_at }, ...cur] : cur.filter((x) => x.id !== t.id)));
    await createClient().from("tasks").update({ done_at }).eq("id", t.id);
  }

  async function cancelReminder(r: ReminderRow) {
    setReminders((cur) => cur.filter((x) => x.id !== r.id));
    await createClient().from("reminders").delete().eq("id", r.id);
  }

  const today = toLocalDate(new Date(), tz);
  const groups: { label: string; items: TaskRow[]; tone?: string }[] = [
    { label: "Atrasadas", tone: "text-danger", items: tasks.filter((t) => t.due_at && toLocalDate(new Date(t.due_at), tz) < today) },
    { label: "Hoje", items: tasks.filter((t) => t.due_at && toLocalDate(new Date(t.due_at), tz) === today) },
    { label: "Próximas", items: tasks.filter((t) => t.due_at && toLocalDate(new Date(t.due_at), tz) > today) },
    { label: "Sem prazo", items: tasks.filter((t) => !t.due_at) },
  ];

  const Row = ({ t }: { t: TaskRow }) => (
    <li className="flex items-center gap-3 rounded-2xl bg-surface border border-line pl-2 pr-4">
      <button onClick={() => toggle(t)} aria-label={t.done_at ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
        className="w-11 h-12 grid place-items-center shrink-0">
        <span className={`w-6 h-6 rounded-full border-2 grid place-items-center ${t.done_at ? "bg-accent border-accent text-on-accent" : t.priority === "high" ? "border-warn" : "border-line-input"}`}>
          {t.done_at && <IconCheck size={14} />}
        </span>
      </button>
      <button onClick={() => setEdit(t)} className="flex-1 min-w-0 text-left py-3">
        <div className={`truncate ${t.done_at ? "line-through text-muted" : ""}`}>{t.title}</div>
        {t.due_at && !t.done_at && <div className="text-xs text-muted mt-0.5 first-letter:uppercase">{fmtDateTime(new Date(t.due_at), tz)}</div>}
      </button>
    </li>
  );

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe">
        <div className="h-14 px-5 flex items-center"><h1 className="text-[17px] font-semibold">Tarefas</h1></div>
        <form onSubmit={add} className="px-4 pb-3">
          <label className="sr-only" htmlFor="new-task">Nova tarefa</label>
          <input id="new-task" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Adicionar tarefa e Enter"
            className="w-full h-12 px-4 rounded-2xl bg-surface border border-line-input" enterKeyHint="done" />
        </form>
      </header>

      <div className="px-4 pb-6 flex flex-col gap-6">
        {loading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10">
            <p className="font-medium">Nada pendente</p>
            <p className="text-sm text-muted mt-1">Escreva acima ou diga ao assistente: “preciso renovar a CNH até o fim do mês”.</p>
          </div>
        ) : (
          groups.filter((g) => g.items.length).map((g) => (
            <section key={g.label}>
              <h2 className={`text-sm font-semibold mb-2 ${g.tone ?? "text-muted"}`}>{g.label} · {g.items.length}</h2>
              <ul className="flex flex-col gap-2">{g.items.map((t) => <Row key={t.id} t={t} />)}</ul>
            </section>
          ))
        )}

        {reminders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted mb-2">Lembretes</h2>
            <ul className="flex flex-col gap-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface border border-line px-4 py-3">
                  <IconBell size={18} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{r.title}</div>
                    <div className="text-xs text-muted mt-0.5 flex items-center gap-1 first-letter:uppercase">
                      {fmtDateTime(new Date(r.remind_at), tz)}{r.recurrence && <><IconRepeat size={12} />{REC[r.recurrence]}</>}
                    </div>
                  </div>
                  <button onClick={() => cancelReminder(r)} aria-label={`Cancelar lembrete ${r.title}`} className="w-9 h-9 grid place-items-center text-muted rounded-full"><IconX size={18} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {done.length > 0 && (
          <section>
            <button onClick={() => setShowDone(!showDone)} className="text-sm font-semibold text-muted" aria-expanded={showDone}>
              {showDone ? "Ocultar" : "Mostrar"} concluídas ({done.length})
            </button>
            {showDone && <ul className="flex flex-col gap-2 mt-2">{done.map((t) => <Row key={t.id} t={t} />)}</ul>}
          </section>
        )}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Editar tarefa">
        {edit && <TaskForm key={edit.id} task={edit} tz={tz} onDone={() => { setEdit(null); load(); }} />}
      </Sheet>
    </div>
  );
}

function TaskForm({ task, tz, onDone }: { task: TaskRow; tz: string; onDone: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_at ? toLocalDateTime(new Date(task.due_at), tz) : "");
  const [priority, setPriority] = useState(task.priority);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await createClient().from("tasks").update({
      title: title.trim(), priority, notes: notes.trim() || null,
      due_at: due ? localToUtc(due, tz).toISOString() : null,
    }).eq("id", task.id);
    setBusy(false);
    onDone();
  }
  async function remove() {
    if (!confirm("Excluir esta tarefa?")) return;
    await createClient().from("tasks").delete().eq("id", task.id);
    onDone();
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Tarefa"><input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} /></Field>
      <Field label="Prazo (lembra nesse horário)">
        <div className="flex gap-2">
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={fieldCls} />
          {due && <button type="button" onClick={() => setDue("")} className="px-3 text-sm text-muted">Limpar</button>}
        </div>
      </Field>
      <Field label="Prioridade">
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskRow["priority"])} className={fieldCls}>
          <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option>
        </select>
      </Field>
      <Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${fieldCls} h-auto py-3`} /></Field>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={remove} className="h-12 px-5 rounded-full border border-line text-danger font-semibold">Excluir</button>
        <button disabled={busy} className="flex-1 h-12 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-60">{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}
