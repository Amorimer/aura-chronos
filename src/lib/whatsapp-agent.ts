import { convertToModelMessages, createIdGenerator, generateText, isStepCount, type FilePart, type TextPart, type UIMessage } from "ai";
import { assistantInstructions, MODEL } from "./assistant";
import { buildTools } from "./agent-tools";
import { getProfile } from "./data";
import { clientAsUser } from "./supabase/admin";
import { downloadMedia, markReadTyping, sendWhatsAppButtons, sendWhatsAppText } from "./whatsapp";
import { expenseButtons } from "./wa-buttons";

export type Inbound = {
  id: string; from: string; type: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  image?: { id: string; caption?: string };
  audio?: { id: string };
  document?: { id: string; caption?: string; mime_type?: string };
};

const newId = createIdGenerator({ prefix: "a", size: 16 });

/** Runs the same assistant as the app for a message that arrived on WhatsApp, and replies there. */
export async function answerOnWhatsApp(userId: string, m: Inbound, hint?: string) {
  const session = await clientAsUser(userId);
  if (!session) {
    await sendWhatsAppText(m.from, "Não consegui abrir sua conta agora. Tente de novo em instantes.");
    return;
  }
  const { supabase, done } = session;
  try {
    const text = (m.text?.body ?? m.button?.text ?? m.image?.caption ?? m.document?.caption ?? "").trim();
    const mediaId = m.image?.id ?? m.audio?.id ?? (m.document?.mime_type === "application/pdf" ? m.document.id : undefined);
    const label = m.audio ? "[áudio enviado pelo WhatsApp]" : m.image ? "[imagem enviada pelo WhatsApp]" : m.document ? "[arquivo enviado pelo WhatsApp]" : "";
    const stored = [label, text].filter(Boolean).join(" ");
    if (!stored) {
      await sendWhatsAppText(m.from, "Por aqui eu entendo texto, áudio, fotos e PDFs. Pode mandar!");
      return;
    }

    // Meta may deliver the same message twice; the message id makes the second one a no-op.
    const userMsg: UIMessage = { id: `w${m.id}`, role: "user", parts: [{ type: "text", text: stored }] };
    const ins = await supabase.from("messages").insert({ id: userMsg.id, role: "user", parts: userMsg.parts });
    if (ins.error) {
      if (ins.error.code !== "23505") console.error("wa store failed", ins.error.message);
      if (ins.error.code === "23505") return;
    }
    await markReadTyping(m.id);

    const [profile, history, memories] = await Promise.all([
      getProfile(supabase, userId),
      supabase.from("messages").select("id,role,parts").neq("id", userMsg.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("memories").select("id,fact").order("created_at").limit(100),
    ]);
    const previous = ((history.data ?? []) as UIMessage[]).reverse();

    const content: (TextPart | FilePart)[] = [];
    if (hint) content.push({ type: "text", text: `[contexto do sistema] ${hint}` });
    if (text) content.push({ type: "text", text });
    if (mediaId) {
      const media = await downloadMedia(mediaId);
      if (media) content.push({ type: "file", data: media.data, mediaType: media.mediaType });
      else content.push({ type: "text", text: "(não consegui baixar o arquivo enviado)" });
    }
    if (!text && m.audio) content.splice(hint ? 1 : 0, 0, { type: "text", text: "Mensagem de voz do usuário:" });

    const source = m.image || m.document ? "image" : m.audio ? "voice" : "chat";
    const result = await generateText({
      model: MODEL,
      instructions: assistantInstructions(profile, memories.data ?? [], "whatsapp"),
      messages: [...(await convertToModelMessages(previous)), { role: "user", content }],
      tools: buildTools({ supabase, userId, tz: profile.timezone, source }),
      stopWhen: isStepCount(8),
    });
    const reply = result.text.trim() || "Feito.";
    // Spends registered in this turn get Confirmar / Corrigir / Apagar, so a wrong value is caught right away.
    const added = result.steps.flatMap((st) => st.toolResults)
      .filter((r) => r.toolName === "add_expense")
      .map((r) => (r.output as { expense?: { id: string; amount: string; description: string; category: string; date: string } }).expense)
      .filter((e): e is NonNullable<typeof e> => !!e);
    if (added.length === 1) {
      await sendWhatsAppButtons(m.from, reply, expenseButtons(added[0].id));
    } else {
      await sendWhatsAppText(m.from, reply);
      for (const e of added.slice(0, 5)) {
        await sendWhatsAppButtons(m.from, `${e.amount} · ${e.description} · ${e.category} · ${e.date.split("-").reverse().join("/")}`, expenseButtons(e.id));
      }
    }
    await supabase.from("messages").insert({
      id: newId(), role: "assistant", parts: [{ type: "text", text: reply }],
      created_at: new Date(Date.now() + 1).toISOString(),
    });
  } catch (err) {
    console.error("wa agent failed", err);
    await sendWhatsAppText(m.from, "Tive um problema para responder agora. Pode mandar de novo?");
  } finally {
    await done();
  }
}
