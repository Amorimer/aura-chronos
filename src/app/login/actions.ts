"use server";

import { redirect } from "next/navigation";
import { PRIVACY_VERSION, TERMS_VERSION } from "../(legal)/legal";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    return { error: "E-mail ou senha incorretos." };
  }
  redirect("/");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 8) return { error: "Use um e-mail válido e uma senha com pelo menos 8 caracteres." };
  if (form.get("accept") !== "on") return { error: "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade." };
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      // LGPD: record when and which versions were accepted.
      data: { display_name: name || undefined, terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) {
    if (/rate/i.test(error.message)) return { error: "Muitos cadastros seguidos. Espere alguns minutos e tente de novo." };
    if (/registered/i.test(error.message)) return { error: "Esse e-mail já tem conta. Use Entrar." };
    if (/database error|not_allowed/i.test(error.message)) {
      return { error: "Este e-mail ainda não foi liberado para usar o Aura Cronos. Peça para quem administra o app incluir você." };
    }
    return { error: error.message };
  }
  if (data.session) redirect("/");
  // Accounts on the allowlist are confirmed on creation, so sign in right away.
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (!e2) redirect("/");
  return { info: `Conta criada. Se pedir confirmação, abra o link enviado para ${email}.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
