"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";
import { Field, fieldCls } from "./sheet";
import { IconTrash } from "./icons";

const ZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife",
  "America/Bahia", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "America/New_York", "UTC"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function Settings({ profile, memories, email, feedUrl }: { profile: Profile; memories: { id: string; fact: string }[]; email: string; feedUrl: string }) {
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState<string | null>(null);
  const [push, setPush] = useState<"unknown" | "on" | "off" | "denied" | "unsupported">("unknown");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [mem, setMem] = useState(memories);
  const [copied, setCopied] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    if (!pushSupported()) { setPush("unsupported"); return; }
    if (Notification.permission === "denied") { setPush("denied"); return; }
    currentSubscription().then((s) => setPush(s ? "on" : "off"));
  }, []);

  async function save(patch: Partial<Profile>) {
    const next = { ...p, ...patch };
    setP(next);
    const { error } = await createClient().from("profiles").update(patch).eq("id", p.id);
    setSaved(error ? "Não foi possível salvar" : "Salvo");
    setTimeout(() => setSaved(null), 1500);
    router.refresh();
  }

  async function togglePush() {
    setPushMsg(null);
    if (push === "on") { await disablePush(); setPush("off"); return; }
    const r = await enablePush();
    if (r === "ok") setPush("on");
    else if (r === "denied") { setPush("denied"); }
    else if (r === "unsupported") setPush("unsupported");
    else setPushMsg("Não deu para ativar agora. Tente de novo.");
  }

  async function testPush() {
    const r = await fetch("/api/push/test", { method: "POST" }).then((r) => r.json()).catch(() => ({ sent: 0 }));
    setPushMsg(r.sent ? "Enviada. Deve chegar em alguns segundos." : "Nenhum aparelho recebeu. Ative as notificações primeiro.");
  }

  async function forget(id: string) {
    setMem((m) => m.filter((x) => x.id !== id));
    await createClient().from("memories").delete().eq("id", id);
  }

  async function clearChat() {
    if (!confirm("Apagar o histórico de conversa com o assistente? Seus eventos, tarefas e notas continuam.")) return;
    await createClient().from("messages").delete().eq("user_id", p.id);
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe">
        <div className="h-14 px-5 flex items-center justify-between">
          <h1 className="text-[17px] font-semibold">Ajustes</h1>
          {saved && <span role="status" className="text-xs text-muted">{saved}</span>}
        </div>
      </header>
      <div className="px-4 pb-8 flex flex-col gap-4">
        <Section title="Notificações">
          {push === "unsupported" ? (
            <p className="text-sm">Este navegador não recebe notificações. No Android, use o Chrome. No iPhone, instale o Aura Chronos na tela inicial (Compartilhar → Adicionar à Tela de Início) e abra por lá.</p>
          ) : push === "denied" ? (
            <p className="text-sm">As notificações estão bloqueadas para este site. Libere em Configurações do navegador → Site → Notificações e volte aqui.</p>
          ) : (
            <label className="flex items-center justify-between gap-4 text-sm">
              <span><span className="font-medium">Lembretes neste aparelho</span><br /><span className="text-muted">Cada aparelho precisa ser ativado uma vez.</span></span>
              <input type="checkbox" checked={push === "on"} onChange={togglePush} disabled={push === "unknown"} className="w-5 h-5 shrink-0 accent-[var(--accent)]" />
            </label>
          )}
          {push === "on" && <button onClick={testPush} className="self-start h-10 px-4 rounded-full border border-line text-sm font-semibold">Enviar notificação de teste</button>}
          {pushMsg && <p role="status" className="text-sm text-muted">{pushMsg}</p>}
          <label className="flex items-center justify-between gap-4 text-sm">
            <span><span className="font-medium">Resumo da manhã</span><br /><span className="text-muted">Seus compromissos e tarefas do dia.</span></span>
            <input type="checkbox" checked={p.morning_brief} onChange={(e) => save({ morning_brief: e.target.checked })} className="w-5 h-5 shrink-0 accent-[var(--accent)]" />
          </label>
          {p.morning_brief && (
            <Field label="Horário do resumo">
              <input type="time" value={p.morning_brief_time.slice(0, 5)} onChange={(e) => e.target.value && save({ morning_brief_time: e.target.value })} className={fieldCls} />
            </Field>
          )}
        </Section>

        {!standalone && (
          <Section title="Instalar como app">
            <p className="text-sm">No Android (Chrome): menu ⋮ → <b>Instalar app</b>. No iPhone (Safari): Compartilhar → <b>Adicionar à Tela de Início</b>. O Aura Chronos abre em tela cheia e os lembretes chegam como os de qualquer app.</p>
          </Section>
        )}

        <Section title="Perfil">
          <Field label="Seu nome"><input defaultValue={p.display_name ?? ""} onBlur={(e) => e.target.value !== (p.display_name ?? "") && save({ display_name: e.target.value })} className={fieldCls} /></Field>
          <Field label="Nome do assistente"><input defaultValue={p.assistant_name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.assistant_name && save({ assistant_name: e.target.value.trim() })} className={fieldCls} /></Field>
          <Field label="Fuso horário">
            <select value={p.timezone} onChange={(e) => save({ timezone: e.target.value })} className={fieldCls}>
              {(ZONES.includes(p.timezone) ? ZONES : [p.timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
            </select>
          </Field>
          <p className="text-xs text-muted">Conta: {email}</p>
        </Section>

        <Section title="Ver no Google Agenda ou no iPhone">
          <p className="text-sm">Assine este endereço para ver os compromissos do Aura Chronos junto com sua agenda. No Google Agenda: Outras agendas → + → <b>Do URL</b>. No iPhone: Ajustes → Calendário → Contas → Adicionar → Outra → <b>Calendário Assinado</b>.</p>
          <div className="flex gap-2">
            <input readOnly value={feedUrl} aria-label="Endereço da agenda" className={`${fieldCls} text-xs font-mono`} onFocus={(e) => e.target.select()} />
            <button onClick={async () => { await navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="h-12 px-4 rounded-xl bg-accent text-on-accent text-sm font-semibold shrink-0">{copied ? "Copiado" : "Copiar"}</button>
          </div>
          <p className="text-xs text-muted">Quem tiver esse endereço vê seus compromissos. O Google atualiza a cada algumas horas.</p>
        </Section>

        <Section title="Memória do assistente">
          {mem.length === 0 ? <p className="text-sm text-muted">Vazia. Conte suas preferências no chat (“prefiro reuniões à tarde”) e o assistente guarda aqui.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {mem.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm">{m.fact}</span>
                  <button onClick={() => forget(m.id)} aria-label={`Esquecer: ${m.fact}`} className="w-9 h-9 grid place-items-center text-muted rounded-full"><IconTrash size={18} /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Conta">
          <button onClick={clearChat} className="self-start text-sm font-semibold">Apagar histórico da conversa</button>
          <form action={signOut}><button className="text-sm font-semibold text-danger">Sair</button></form>
        </Section>
      </div>
    </div>
  );
}
