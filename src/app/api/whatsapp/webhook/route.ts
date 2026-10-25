import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText, validSignature } from "@/lib/whatsapp";

// Meta calls GET once to verify the URL.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type Inbound = { from: string; type: string; text?: { body: string }; button?: { text: string } };

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

  for (const m of messages) {
    const text = (m.text?.body ?? m.button?.text ?? "").trim();
    const code = text.toUpperCase().match(/AURA-[A-F0-9]{6}/)?.[0];
    if (code) {
      const { data: name } = await sb.rpc("wa_link", { p_secret: secret, p_code: code, p_phone: m.from });
      if (name !== null && name !== undefined) {
        await sendWhatsAppText(m.from,
          `Pronto${name ? `, ${name}` : ""}! Seu WhatsApp está conectado ao Aura Cronos. Seus lembretes e o resumo da manhã vão chegar aqui.\n\nPara parar, mande PARAR.`);
      } else {
        await sendWhatsAppText(m.from, "Esse código expirou ou não existe. Abra o Aura Cronos em Ajustes e toque em Conectar WhatsApp de novo.");
      }
      continue;
    }
    const stop = /^(parar|sair|stop|cancelar)$/i.test(text);
    const start = /^(voltar|ativar|start)$/i.test(text);
    const { data: name } = await sb.rpc("wa_touch", { p_secret: secret, p_phone: m.from, p_stop: stop });
    if (name === null || name === undefined) {
      await sendWhatsAppText(m.from, `Este número ainda não está conectado. No Aura Cronos, abra Ajustes e toque em Conectar WhatsApp.${appUrl ? `\n${appUrl}/ajustes` : ""}`);
    } else if (stop) {
      await sendWhatsAppText(m.from, "Certo, parei de enviar lembretes por aqui. Para voltar, ative em Ajustes no app.");
    } else if (start) {
      await sendWhatsAppText(m.from, "Para voltar a receber, ative \"Lembretes no WhatsApp\" em Ajustes no app.");
    } else {
      await sendWhatsAppText(m.from, `Por aqui eu envio seus lembretes. Para criar ou mudar compromissos, use o app:${appUrl ? `\n${appUrl}` : ""}`);
    }
  }
  return new Response("ok");
}
