"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { occurrencesBetween } from "@/lib/data";
import { addDaysToDate, dayRange, fmtDay, fmtTime, localToUtc, toLocalDate } from "@/lib/time";
import type { EventRow, Occurrence, TaskRow } from "@/lib/types";
import { EventSheet, type EventDraft } from "./event-sheet";
import { IconAlert, IconBell, IconChevronLeft, IconChevronRight, IconPhone, IconPin, IconPlus, IconRepeat } from "./icons";

function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDaysToDate(day, -dow);
}

export function Agenda({ tz }: { tz: string }) {
  const today = toLocalDate(new Date(), tz);
  const [day, setDay] = useState(today);
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const week = mondayOf(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToDate(week, i)), [week]);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { from } = dayRange(week, tz);
    const { to } = dayRange(addDaysToDate(week, 6), tz);
    const [o, t] = await Promise.all([
      occurrencesBetween(sb, from, to, tz).catch(() => []),
      sb.from("tasks").select("*").is("done_at", null).gte("due_at", from.toISOString()).lt("due_at", to.toISOString()).order("due_at"),
    ]);
    setOcc(o);
    setTasks((t.data as TaskRow[]) ?? []);
    setLoading(false);
  }, [week, tz]);

  useEffect(() => { load(); }, [load]);

  // deep links: /agenda?d=YYYY-MM-DD&e=<id>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("d");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDay(d);
    const id = q.get("e");
    if (id) {
      createClient().from("events").select("*").eq("id", id).single().then(({ data }) => {
        if (data) { setDay(toLocalDate(new Date((data as EventRow).start_at), tz)); setDraft(data as EventRow); }
      });
    }
  }, [tz]);

  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occ) {
      // an occurrence can span several days
      let d = toLocalDate(new Date(o.occurrence_start), tz);
      const last = toLocalDate(new Date(new Date(o.occurrence_end).getTime() - 1), tz);
      for (let i = 0; i < 31 && d <= last; i++, d = addDaysToDate(d, 1)) {
        if (!m.has(d)) m.set(d, []);
        m.get(d)!.push(o);
      }
    }
    return m;
  }, [occ, tz]);

  const list = (byDay.get(day) ?? []).slice().sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.occurrence_start.localeCompare(b.occurrence_start));
  const timed = list.filter((o) => !o.all_day);
  const clash = new Set<string>();
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    if (timed[j].occurrence_start < timed[i].occurrence_end) { clash.add(timed[i].key); clash.add(timed[j].key); }
  }
  const dayTasks = tasks.filter((t) => t.due_at && toLocalDate(new Date(t.due_at), tz) === day);
  const now = Date.now();

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe border-b border-line">
        <div className="h-14 px-3 flex items-center justify-between">
          <button onClick={() => setDay(addDaysToDate(day, -7))} aria-label="Semana anterior" className="w-10 h-10 grid place-items-center rounded-full"><IconChevronLeft /></button>
          <div className="text-center">
            <h1 className="text-[17px] font-semibold first-letter:uppercase">{fmtDay(localToUtc(day, tz), tz, { month: "long", year: "numeric" })}</h1>
          </div>
          <div className="flex items-center">
            {day !== today && <button onClick={() => setDay(today)} className="text-xs font-semibold text-accent px-2 h-10">Hoje</button>}
            <button onClick={() => setDay(addDaysToDate(day, 7))} aria-label="Próxima semana" className="w-10 h-10 grid place-items-center rounded-full"><IconChevronRight /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 px-2 pb-2" role="tablist" aria-label="Dias da semana">
          {days.map((d) => {
            const has = (byDay.get(d)?.length ?? 0) > 0;
            const sel = d === day;
            const date = localToUtc(d, tz);
            return (
              <button key={d} role="tab" aria-selected={sel} onClick={() => setDay(d)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-2xl ${sel ? "bg-ink text-bg" : ""}`}>
                <span className={`text-[11px] uppercase ${sel ? "" : "text-muted"}`}>{fmtDay(date, tz, { weekday: "short" }).replace(".", "")}</span>
                <span className={`text-[17px] font-semibold ${d === today && !sel ? "text-accent" : ""}`}>{Number(d.slice(8))}</span>
                <span className={`w-1 h-1 rounded-full ${has ? (sel ? "bg-bg" : "bg-accent") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </header>

      <section className="px-4 py-4 flex-1">
        <h2 className="text-sm font-semibold text-muted mb-3 first-letter:uppercase">{fmtDay(localToUtc(day, tz), tz)}</h2>
        {loading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
        ) : list.length === 0 && dayTasks.length === 0 ? (
          <div className="text-center py-14">
            <p className="font-medium">Dia livre</p>
            <p className="text-sm text-muted mt-1">Toque em + ou peça ao assistente: “almoço com a Ana sexta 12h30”.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {list.map((o) => {
              const past = new Date(o.occurrence_end).getTime() < now;
              return (
                <li key={o.key}>
                  <button onClick={() => setDraft(o)}
                    className={`w-full text-left flex gap-3 rounded-2xl bg-surface border px-4 py-3 ${clash.has(o.key) ? "border-warn" : "border-line"} ${past ? "opacity-60" : ""}`}>
                    <div className="w-14 shrink-0 text-sm">
                      {o.all_day ? <span className="text-muted">Dia todo</span> : (
                        <><div className="font-semibold">{fmtTime(new Date(o.occurrence_start), tz)}</div>
                          <div className="text-muted text-xs">{fmtTime(new Date(o.occurrence_end), tz)}</div></>
                      )}
                    </div>
                    <div className={`w-1 rounded-full shrink-0 ${o.important ? "bg-warn" : "bg-accent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{o.title}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-0.5">
                        {o.location && <span className="flex items-center gap-1 min-w-0"><IconPin size={12} /><span className="truncate">{o.location}</span></span>}
                        {o.recurrence && <span className="flex items-center gap-1"><IconRepeat size={12} />repete</span>}
                        {o.remind_minutes != null && <span className="flex items-center gap-1"><IconBell size={12} />{o.remind_minutes === 0 ? "na hora" : `${o.remind_minutes} min`}</span>}
                        {o.important && <span className="flex items-center gap-1 text-warn"><IconPhone size={12} />importante</span>}
                        {clash.has(o.key) && <span className="flex items-center gap-1 text-warn"><IconAlert size={12} />conflito</span>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {!loading && dayTasks.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted mb-2">Tarefas com prazo hoje</h3>
            <ul className="flex flex-col gap-2">
              {dayTasks.map((t) => (
                <li key={t.id} className="rounded-2xl bg-surface border border-line px-4 py-3 flex justify-between gap-3">
                  <span className="truncate">{t.title}</span>
                  <span className="text-sm text-muted shrink-0">{fmtTime(new Date(t.due_at!), tz)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <button onClick={() => setDraft({ defaultDay: day })} aria-label="Novo evento"
        className="fixed right-5 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 w-14 h-14 rounded-full bg-accent text-on-accent shadow-lg grid place-items-center">
        <IconPlus size={26} />
      </button>

      <EventSheet draft={draft} tz={tz} onClose={() => { setDraft(null); if (window.location.search) window.history.replaceState(null, "", "/agenda"); }} onSaved={load} />
    </div>
  );
}
