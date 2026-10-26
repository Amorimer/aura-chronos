"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");

function mask(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return phone;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) •••••-${d.slice(-4)}`;
}

export function WhatsAppConnect({ userId, initialPhone, initialNotify }: { userId: string; initialPhone: string | null; initialNotify: boolean }) {
  const [phone, setPhone] = useState(initialPhone);
  const [notify, setNotify] = useState(initialNotify);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  if (!NUMBER) {
    return <p className="text-sm text-muted">A conexão com WhatsApp ainda está sendo configurada pelo administrador do app.</p>;
  }

  async function connect() {
    setMsg(null);
    setBusy(true);
    const { data, error } = await createClient().rpc("wa_new_code");
    setBusy(false);
    if (error || !data) return setMsg("Não deu para gerar o código agora. Tente de novo.");
    setCode(data as string);
    if (poll.current) clearInterval(poll.current);
    const started = Date.now();
    poll.current = setInterval(async () => {
      const { data: p } = await createClient().from("profiles").select("whatsapp_phone").eq("id", userId).single();
      if (p?.whatsapp_phone) {
        setPhone(p.whatsapp_phone);
        setNotify(true);
        setCode(null);
        setMsg("WhatsApp conectado. Você recebeu uma mensagem de confirmação lá.");
        clearInterval(poll.current!);
      } else if (Date.now() - started > 30 * 60e3) {
        clearInterval(poll.current!);
      }
    }, 3000);
  }

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp? Os lembretes deixam de chegar por lá.")) return;
    await createClient().rpc("wa_disconnect");
    setPhone(null);
    setMsg(null);
  }

  async function toggle(v: boolean) {
    setNotify(v);
    await createClient().from("profiles").update({ whatsapp_notify: v }).eq("id", userId);
  }

  async function test() {
    setMsg("Enviando…");
    const r = await fetch("/api/whatsapp/test", { method: "POST" }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (r.ok) setMsg("Mensagem de teste enviada. Confira o WhatsApp.");
    else if (r.detail?.skipped) setMsg("Faz mais de 23h que você não escreve para o Aura Cronos no WhatsApp. Mande qualquer mensagem lá e tente de novo.");
    else setMsg("Não foi possível enviar. Tente de novo em instantes.");
  }

  if (phone) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">Conectado: <b>{mask(phone)}</b></p>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span><span className="font-medium">Lembretes no WhatsApp</span><br /><span className="text-muted">Lembretes, alertas e o resumo da manhã.</span></span>
          <input type="checkbox" checked={notify} onChange={(e) => toggle(e.target.checked)} className="w-5 h-5 shrink-0 accent-[var(--accent)]" />
        </label>
        <div className="flex gap-2 flex-wrap">
          <button onClick={test} className="h-10 px-4 rounded-full border border-line text-sm font-semibold">Enviar teste</button>
          <button onClick={disconnect} className="h-10 px-4 rounded-full text-sm font-semibold text-danger">Desconectar</button>
        </div>
        {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Receba seus lembretes também no WhatsApp. Cada pessoa conecta o próprio número, neste aparelho.</p>
      {!code && (
        <button onClick={connect} disabled={busy} className="self-start h-11 px-5 rounded-full bg-[#1f9d55] text-white text-sm font-semibold disabled:opacity-60">
          {busy ? "Gerando código…" : "Conectar WhatsApp"}
        </button>
      )}
      {code && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Toque abaixo: o WhatsApp abre na conversa com o Aura Cronos com a mensagem <b className="text-ink">Conectar {code}</b> pronta. É só enviar. Esta tela atualiza sozinha quando a conexão for confirmada. O código vale 30 minutos.
          </p>
          <a href={`https://wa.me/${NUMBER}?text=${encodeURIComponent(`Conectar ${code}`)}`} target="_blank" rel="noreferrer"
            className="self-start h-11 px-5 rounded-full bg-[#1f9d55] text-white text-sm font-semibold inline-flex items-center">Abrir WhatsApp e enviar código</a>
          <p className="text-xs text-muted">Se não abrir, mande o código acima para o número +55 21 96623-9038 no WhatsApp.</p>
        </div>
      )}
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
