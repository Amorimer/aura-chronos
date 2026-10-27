"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;
  const [linkError, setLinkError] = useState(false);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setLinkError(q.get("erro") === "link");
    setDeleted(q.get("conta") === "excluida");
  }, []);

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 max-w-sm mx-auto pt-safe">
      <div className="mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" width={56} height={56} className="rounded-2xl mb-5" />
        <div className="text-[13px] font-semibold tracking-wide uppercase text-accent">Aura Cronos · Assistente Pessoal</div>
        <h1 className="mt-2 text-[28px] leading-[34px] font-bold">A autoridade absoluta em otimizar o seu tempo.</h1>
        <p className="mt-3 text-muted text-[15px] leading-6">
          Mande uma mensagem, um print de convite ou um áudio. Vira compromisso, tarefa ou lembrete, e você é avisado na hora.
        </p>
      </div>

      <div role="tablist" className="grid grid-cols-2 p-1 rounded-full bg-surface-2 mb-6">
        {(["in", "up"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`h-10 rounded-full text-sm font-semibold transition ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}>
            {m === "in" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form action={mode === "in" ? inAction : upAction} className="flex flex-col gap-4">
        {mode === "up" && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Como devo te chamar?
            <input name="name" autoComplete="given-name" className="h-12 px-4 rounded-xl bg-surface border border-line-input" />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          E-mail
          <input name="email" type="email" required autoComplete="email" inputMode="email"
            className="h-12 px-4 rounded-xl bg-surface border border-line-input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Senha
          <input name="password" type="password" required minLength={mode === "up" ? 8 : undefined}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            className="h-12 px-4 rounded-xl bg-surface border border-line-input" />
        </label>
        {mode === "up" && (
          <label className="flex items-start gap-3 text-sm leading-5">
            <input name="accept" type="checkbox" required className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--accent)]" />
            <span>
              Li e aceito os <a href="/termos" target="_blank" className="underline font-medium">Termos de Uso</a> e a{" "}
              <a href="/privacidade" target="_blank" className="underline font-medium">Política de Privacidade</a>, e autorizo o
              tratamento dos meus dados conforme a LGPD.
            </span>
          </label>
        )}
        {(state.error || (linkError && !state.info)) && (
          <p role="alert" className="text-sm text-danger bg-danger-soft rounded-xl px-4 py-3">
            {state.error ?? "O link expirou ou já foi usado. Entre com e-mail e senha."}
          </p>
        )}
        {deleted && !state.error && !state.info && (
          <p role="status" className="text-sm bg-accent-soft rounded-xl px-4 py-3">Sua conta e todos os seus dados foram excluídos.</p>
        )}
        {state.info && <p role="status" className="text-sm bg-accent-soft rounded-xl px-4 py-3">{state.info}</p>}
        <button disabled={pending} className="h-12 mt-2 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-60">
          {pending ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </main>
  );
}
