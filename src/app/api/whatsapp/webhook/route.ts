import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppText, validSignature } from "@/lib/whatsapp";
import { answerOnWhatsApp, type Inbound } from "@/lib/whatsapp-agent";
import { adminClient, adminConfigured } from "@/lib/supabase/admin";
import { parseAction, runAction } from "@/lib/wa-actions";

export const maxDuration = 120;

// Meta calls GET once to verify the URL.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("bad signature", { status: 401 });
  }
  const payload = JSON.parse(raw);
  const secret = process.env.CRON_SECRET!;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const messages: Inbound[] = (payload.entry ?? []).flatMap((e: { changes?: { value?: { messages?: Inbound[] } }[] }) =>
    (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));

  // Answer Meta right away; the assistant can take a few seconds.
  after(() => handle(messages, sb, secret, appUrl));
  return new Response("ok");
}

async function handle(messages: Inbound[], sb: SupabaseClient, secret: string, appUrl: string) {
  for (const m of messages) {
    const tap = m.interactive?.button_reply ?? m.interactive?.list_reply;
    const text = (m.text?.body ?? m.button?.text ?? tap?.title ?? "").trim();
    const code = text.toUpperCase().match(/AURA-[A-F0-9]{6}/)?.[0];
    if (code) {
      const { data: name } = await sb.rpc("wa_link", { p_secret: secret, p_code: code, p_phone: m.from });
      if (name !== null && name !== undefined) {
        await sendWhatsAppText(m.from,
          `Pronto${name ? `, ${name}` : ""}! Seu WhatsApp está conectado ao Aura Cronos. Seus lembretes e o resumo da manhã vão chegar aqui, e você pode falar comigo por aqui como no app: marcar compromissos, criar tarefas, guardar notas, mandar áudio ou print.\n\nExperimente: \"reunião amanhã às 15h\" ou \"como está minha semana?\"\n\nPara parar os lembretes, mande PARAR.`);
      } else {
        await sendWhatsAppText(m.from, "Esse código expirou ou não existe. Abra o Aura Cronos em Ajustes e toque em Conectar WhatsApp de novo.");
      }
      continue;
    }
    const stop = /^(parar|stop)$/i.test(text);
    const start = /^(voltar|ativar|start)$/i.test(text);
    const { data: name } = await sb.rpc("wa_touch", { p_secret: secret, p_phone: m.from, p_stop: stop });
    if (name === null || name === undefined) {
      await sendWhatsAppText(m.from, `Este número ainda não está conectado. No Aura Cronos, abra Ajustes e toque em Conectar WhatsApp.${appUrl ? `\n${appUrl}/ajustes` : ""}`);
    } else if (stop) {
      await sendWhatsAppText(m.from, "Certo, parei de enviar lembretes por aqui. Para voltar, ative em Ajustes no app.");
    } else if (start) {
      await sendWhatsAppText(m.from, "Para voltar a receber, ative \"Lembretes no WhatsApp\" em Ajustes no app.");
    } else if (!adminConfigured()) {
      await sendWhatsAppText(m.from, `Por aqui eu envio seus lembretes. Para criar ou mudar compromissos, use o app:${appUrl ? `\n${appUrl}` : ""}`);
    } else {
      const db = adminClient();
      const { data: p } = await db.from("profiles").select("id,timezone,wa_pending").eq("whatsapp_phone", m.from).single();
      if (!p?.id) continue;
      const action = parseAction(tap?.id ?? m.button?.payload);
      if (action) {
        await onTap(db, p.id, p.timezone, m, tap?.title ?? text, action);
        continue;
      }
      // After "Outra data", the next message is the new date for that item.
      const pending = p.wa_pending as { action: string; kind: string; id: string; title: string; expires: string } | null;
      let hint: string | undefined;
      if (pending) {
        await db.from("profiles").update({ wa_pending: null }).eq("id", p.id);
        if (pending.action === "fix_expense" && new Date(pending.expires) > new Date()) {
          hint = `O usuário tocou em "Corrigir" no gasto "${pending.title}" (id ${pending.id}). A mensagem a seguir diz o que corrigir (valor, descrição, categoria ou data). Use update_expense com esse id e confirme em uma linha. Se ele pedir para apagar, use delete_expense.`;
        } else if (pending.action === "reschedule" && new Date(pending.expires) > new Date()) {
          const what = pending.kind === "e" ? "o compromisso" : pending.kind === "t" ? "a tarefa" : "o lembrete";
          const tool = pending.kind === "e" ? "update_event (mantenha a duração)" : pending.kind === "t" ? "update_task (due_at)" : "cancel_reminder com esse id e depois create_reminder com o mesmo título na nova hora";
          hint = `O usuário tocou em "Adiar → Outra data" para ${what} "${pending.title}" (id ${pending.id}). A mensagem a seguir é a nova data/hora. Use ${tool} com esse id e confirme em uma linha. Se a mensagem não for uma data, responda normalmente.`;
        }
      }
      await answerOnWhatsApp(p.id, m, hint);
    }
  }
}

/** A tap on a reminder button. Stored in the chat history like any message, so the assistant has context. */
async function onTap(db: SupabaseClient, userId: string, tz: string, m: Inbound, label: string, action: NonNullable<ReturnType<typeof parseAction>>) {
  // Meta may deliver the same tap twice; the message id makes the second one a no-op.
  const ins = await db.from("messages").insert({ id: `w${m.id}`, user_id: userId, role: "user", parts: [{ type: "text", text: `[botão no WhatsApp] ${label}` }] });
  if (ins.error?.code === "23505") return;
  try {
    const reply = await runAction(db, userId, tz, m.from, action);
    await db.from("messages").insert({
      id: `a${m.id}`, user_id: userId, role: "assistant", parts: [{ type: "text", text: reply }],
      created_at: new Date(Date.now() + 1).toISOString(),
    });
  } catch (err) {
    console.error("wa tap failed", action, err);
    await sendWhatsAppText(m.from, "Não consegui fazer isso agora. Tente de novo em instantes.");
  }
}
