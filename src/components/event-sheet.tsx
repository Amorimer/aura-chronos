"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDaysToDate, localToUtc, toLocalDate, toLocalDateTime } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import { Field, fieldCls, Sheet } from "./sheet";

export type EventDraft = Partial<EventRow> & { defaultDay?: string };

const REMIND = [
  { v: "", l: "Sem lembrete" }, { v: "0", l: "Na hora" }, { v: "10", l: "10 min antes" },
  { v: "30", l: "30 min antes" }, { v: "60", l: "1 hora antes" }, { v: "1440", l: "1 dia antes" },
];

export function EventSheet({ draft, tz, onClose, onSaved }: { draft: EventDraft | null; tz: string; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet open={!!draft} onClose={onClose} title={draft?.id ? "Editar evento" : "Novo evento"}>
      {draft && <EventForm key={draft.id ?? "new"} draft={draft} tz={tz} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function EventForm({ draft, tz, onClose, onSaved }: { draft: EventDraft; tz: string; onClose: () => void; onSaved: () => void }) {
  const start = draft.start_at ? new Date(draft.start_at) : null;
  const end = draft.end_at ? new Date(draft.end_at) : null;
  const allDay0 = !!draft.all_day;
  const nextHour = () => {
    const d = new Date(Date.now() + 3600000);
    const s = toLocalDateTime(d, tz);
    return s.slice(11, 13) + ":00";
  };
  const [title, setTitle] = useState(draft.title ?? "");
  const [allDay, setAllDay] = useState(allDay0);
  const [date, setDate] = useState(() => (start ? toLocalDate(start, tz) : draft.defaultDay ?? toLocalDate(new Date(), tz)));
  const [endDate, setEndDate] = useState(end ? (allDay0 ? addDaysToDate(toLocalDate(end, tz), -1) : toLocalDate(end, tz)) : date);
  const [t1, setT1] = useState(() => (start && !allDay0 ? toLocalDateTime(start, tz).slice(11) : nextHour()));
  const [t2, setT2] = useState(end && !allDay0 ? toLocalDateTime(end, tz).slice(11) : "");
  const [location, setLocation] = useState(draft.location ?? "");
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [rec, setRec] = useState<string>(draft.recurrence ?? "");
  const [until, setUntil] = useState(draft.recurrence_until ?? "");
  const [remind, setRemind] = useState(draft.id ? (draft.remind_minutes == null ? "" : String(draft.remind_minutes)) : "30");
  const [important, setImportant] = useState(!!draft.important);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr("Dê um título ao evento.");
    let s: Date, en: Date;
    if (allDay) {
      s = localToUtc(date, tz);
      en = localToUtc(addDaysToDate(endDate < date ? date : endDate, 1), tz);
    } else {
      s = localToUtc(`${date}T${t1}`, tz);
      en = t2 ? localToUtc(`${endDate < date ? date : endDate}T${t2}`, tz) : new Date(s.getTime() + 3600000);
      if (en < s) return setErr("O fim precisa ser depois do início.");
    }
    setBusy(true);
    const row = {
      title: title.trim(), all_day: allDay, start_at: s.toISOString(), end_at: en.toISOString(),
      location: location.trim() || null, notes: notes.trim() || null,
      recurrence: rec || null, recurrence_until: rec && until ? until : null,
      remind_minutes: remind === "" ? null : Number(remind), important,
    };
    const sb = createClient();
    const { error } = draft.id
      ? await sb.from("events").update(row).eq("id", draft.id)
      : await sb.from("events").insert({ ...row, source: "manual" });
    setBusy(false);
    if (error) return setErr("Não foi possível salvar. Tente de novo.");
    onSaved();
    onClose();
  }

  async function remove() {
    if (!draft.id) return;
    if (!confirm(draft.recurrence ? "Excluir este evento e todas as repetições?" : "Excluir este evento?")) return;
    setBusy(true);
    await createClient().from("events").delete().eq("id", draft.id);
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} autoFocus={!draft.id} /></Field>
      <label className="flex items-center justify-between text-sm font-medium">
        Dia inteiro
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início"><input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} className={fieldCls} required /></Field>
        {!allDay ? <Field label="Hora"><input type="time" value={t1} onChange={(e) => setT1(e.target.value)} className={fieldCls} required /></Field> : <div />}
        <Field label="Fim"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} /></Field>
        {!allDay ? <Field label="Hora final"><input type="time" value={t2} onChange={(e) => setT2(e.target.value)} className={fieldCls} placeholder="+1h" /></Field> : <div />}
      </div>
      <Field label="Local"><input value={location} onChange={(e) => setLocation(e.target.value)} className={fieldCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repetir">
          <select value={rec} onChange={(e) => setRec(e.target.value)} className={fieldCls}>
            <option value="">Não repete</option><option value="daily">Todo dia</option><option value="weekly">Toda semana</option>
            <option value="monthly">Todo mês</option><option value="yearly">Todo ano</option>
          </select>
        </Field>
        {rec ? <Field label="Até (opcional)"><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={fieldCls} /></Field> : <div />}
      </div>
      <Field label="Lembrete">
        <select value={remind} onChange={(e) => setRemind(e.target.value)} className={fieldCls}>
          {REMIND.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </Field>
      <label className="flex items-start justify-between gap-4 text-sm">
        <span><span className="font-medium">Importante</span><br /><span className="text-muted">Alerta insistente na hora do evento, que fica na tela até você abrir.</span></span>
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--accent)]" />
      </label>
      <Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${fieldCls} h-auto py-3`} /></Field>
      {draft.recurrence && draft.id && <p className="text-xs text-muted">Mudanças valem para todas as repetições.</p>}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex gap-3 pt-1">
        {draft.id && <button type="button" onClick={remove} disabled={busy} className="h-12 px-5 rounded-full border border-line text-danger font-semibold">Excluir</button>}
        <button disabled={busy} className="flex-1 h-12 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-60">{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}
