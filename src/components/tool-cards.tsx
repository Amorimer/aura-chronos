"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconAlert, IconBell, IconCalendar, IconCheckSquare, IconNote, IconPhone, IconPin, IconRepeat } from "./icons";

type Part = {
  type: string; toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>; output?: Record<string, unknown> & { error?: string }; errorText?: string;
};

const RUNNING: Record<string, string> = {
  list_agenda: "Olhando a agenda", find_events: "Procurando eventos", create_event: "Criando evento",
  update_event: "Atualizando evento", delete_event: "Excluindo evento", create_task: "Criando tarefa",
  list_tasks: "Olhando tarefas", update_task: "Atualizando tarefa", delete_task: "Excluindo tarefa",
  create_note: "Salvando nota", find_notes: "Procurando notas", update_note: "Atualizando nota",
  create_reminder: "Criando lembrete", list_reminders: "Olhando lembretes", cancel_reminder: "Cancelando lembrete",
  remember: "Guardando na memória", forget: "Apagando da memória",
};
const REC: Record<string, string> = { daily: "todo dia", weekly: "toda semana", monthly: "todo mês", yearly: "todo ano" };

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "danger" }) {
  return <div className={`text-xs px-3 py-1.5 rounded-full ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"}`}>{children}</div>;
}

function Undo({ table, id, label = "Desfazer" }: { table: string; id: string; label?: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <span className="text-xs text-muted">Desfeito</span>;
  return (
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      const { error } = await createClient().from(table).delete().eq("id", id);
      setBusy(false);
      if (!error) setDone(true);
    }} className="text-xs font-semibold text-muted hover:text-danger">{label}</button>
  );
}

function Card({ icon, kind, children, footer }: { icon: React.ReactNode; kind: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="w-[85%] rounded-2xl bg-surface border border-line overflow-hidden">
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{icon}{kind}</div>
        <div className="mt-1.5">{children}</div>
      </div>
      {footer && <div className="px-4 py-2.5 border-t border-line flex items-center justify-between gap-3">{footer}</div>}
    </div>
  );
}

export function ToolPart({ part }: { part: Part }) {
  const name = part.type.slice(5);
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <Chip>{RUNNING[name] ?? "Trabalhando"}…</Chip>;
  }
  if (part.state === "output-error" || part.output?.error) {
    return <Chip tone="danger">{RUNNING[name] ?? "Ação"}: não deu certo ({part.output?.error ?? "erro"})</Chip>;
  }
  const out = part.output ?? {};

  if (name === "create_event" || name === "update_event") {
    const e = out.event as Record<string, string & number & boolean>;
    const conflicts = (out.conflicts as { title: string; when: string }[]) ?? [];
    if (!e) return null;
    return (
      <Card icon={<IconCalendar size={14} />} kind={name === "create_event" ? "Evento criado" : "Evento atualizado"}
        footer={<>
          <Link href={`/agenda?d=${String(e.start).slice(0, 10)}&e=${e.id}`} className="text-xs font-semibold text-accent">Ver na agenda</Link>
          {name === "create_event" && <Undo table="events" id={e.id} />}
        </>}>
        <div className="font-semibold text-[15px]">{e.title}</div>
        <div className="text-sm text-muted mt-0.5 first-letter:uppercase">{e.all_day ? `${e.when} · dia inteiro` : e.when}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted">
          {e.location && <span className="flex items-center gap-1"><IconPin size={13} />{e.location}</span>}
          {e.recurrence && <span className="flex items-center gap-1"><IconRepeat size={13} />{REC[e.recurrence]}</span>}
          {e.remind_minutes != null && <span className="flex items-center gap-1"><IconBell size={13} />{e.remind_minutes === 0 ? "na hora" : `${e.remind_minutes} min antes`}</span>}
          {e.important && <span className="flex items-center gap-1 text-warn"><IconPhone size={13} />alerta insistente</span>}
        </div>
        {conflicts.length > 0 && (
          <div className="mt-3 text-xs bg-warn-soft text-warn rounded-lg px-3 py-2 flex gap-2">
            <IconAlert size={14} className="shrink-0 mt-px" />
            <span>Conflita com {conflicts.map((c) => `${c.title} (${c.when})`).join(", ")}</span>
          </div>
        )}
      </Card>
    );
  }
  if (name === "create_task" || name === "update_task") {
    const t = out.task as Record<string, string & boolean>;
    if (!t) return null;
    return (
      <Card icon={<IconCheckSquare size={14} />} kind={t.done ? "Tarefa concluída" : name === "create_task" ? "Tarefa criada" : "Tarefa atualizada"}
        footer={<><Link href="/tarefas" className="text-xs font-semibold text-accent">Ver tarefas</Link>{name === "create_task" && <Undo table="tasks" id={t.id} />}</>}>
        <div className={`font-semibold text-[15px] ${t.done ? "line-through text-muted" : ""}`}>{t.title}</div>
        {t.when && <div className="text-sm text-muted mt-0.5">Prazo: {t.when}</div>}
        {t.priority === "high" && <div className="text-xs text-warn mt-1">Prioridade alta</div>}
      </Card>
    );
  }
  if (name === "create_note" || name === "update_note") {
    const n = out.note as Record<string, string>;
    if (!n) return null;
    return (
      <Card icon={<IconNote size={14} />} kind={name === "create_note" ? "Nota salva" : "Nota atualizada"}
        footer={<><Link href={`/notas?n=${n.id}`} className="text-xs font-semibold text-accent">Abrir nota</Link>{name === "create_note" && <Undo table="notes" id={n.id} />}</>}>
        {n.title && <div className="font-semibold text-[15px]">{n.title}</div>}
        <div className="text-sm text-muted mt-0.5 line-clamp-3 whitespace-pre-wrap">{n.body}</div>
      </Card>
    );
  }
  if (name === "create_reminder") {
    const r = out.reminder as Record<string, string>;
    if (!r) return null;
    return (
      <Card icon={<IconBell size={14} />} kind="Lembrete criado" footer={<><span className="text-xs text-muted">Chega como notificação</span><Undo table="reminders" id={r.id} /></>}>
        <div className="font-semibold text-[15px]">{r.title}</div>
        <div className="text-sm text-muted mt-0.5 first-letter:uppercase">{r.when}{r.recurrence ? ` · ${REC[r.recurrence]}` : ""}</div>
      </Card>
    );
  }
  if (name.startsWith("delete_") || name === "cancel_reminder") {
    const d = (out.deleted ?? out.cancelled) as { title?: string } | undefined;
    return <Chip>{name === "cancel_reminder" ? "Lembrete cancelado" : "Excluído"}{d?.title ? `: ${d.title}` : ""}</Chip>;
  }
  if (name === "remember") return <Chip>Guardei na memória</Chip>;
  if (name === "forget") return <Chip>Apaguei da memória</Chip>;
  return null;
}
