import {
  convertToModelMessages, createIdGenerator, createUIMessageStreamResponse, isStepCount, streamText,
  toUIMessageStream, type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { buildTools } from "@/lib/agent-tools";
import { fmtDay, toLocalDateTime } from "@/lib/time";

export const maxDuration = 120;

// With a Google AI Studio key the app talks to Gemini directly (free tier, no card).
// Otherwise it goes through the Vercel AI Gateway, which needs a card on the Vercel account.
const MODEL = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ? google(process.env.GOOGLE_MODEL || "gemini-3.5-flash-lite")
  : process.env.AI_MODEL || "google/gemini-2.5-flash";

/** File parts are sent once to the model, then replaced by a short placeholder in storage. */
function stripFiles(m: UIMessage): UIMessage {
  return {
    ...m,
    parts: m.parts.map((p) =>
      p.type === "file"
        ? { type: "text" as const, text: p.mediaType?.startsWith("audio/") ? "[áudio enviado]" : `[${p.mediaType?.startsWith("image/") ? "imagem" : "arquivo"} enviado]` }
        : p,
    ),
  };
}

export async function POST(req: Request) {
  const { supabase, userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { message }: { message: UIMessage } = await req.json();
  if (!message || message.role !== "user" || !Array.isArray(message.parts)) {
    return new Response("bad request", { status: 400 });
  }
  const files = message.parts.filter((p) => p.type === "file");
  if (files.length > 4) return new Response("too many files", { status: 413 });
  const size = JSON.stringify(message).length;
  if (size > 12_000_000) return new Response("too large", { status: 413 });

  const [profile, history, memories] = await Promise.all([
    getProfile(supabase, userId),
    supabase.from("messages").select("id,role,parts").order("created_at", { ascending: false }).limit(30),
    supabase.from("memories").select("id,fact").order("created_at").limit(100),
  ]);
  const tz = profile.timezone;
  const previous = ((history.data ?? []) as UIMessage[]).reverse();

  const source = files.some((f) => f.type === "file" && f.mediaType?.startsWith("image/")) ? "image"
    : files.some((f) => f.type === "file" && f.mediaType?.startsWith("audio/")) ? "voice" : "chat";
  const tools = buildTools({ supabase, userId, tz, source });

  const now = new Date();
  const mem = (memories.data ?? []).map((m) => `- (${m.id}) ${m.fact}`).join("\n") || "(vazia)";

  const instructions = `Você é ${profile.assistant_name}, assistente pessoal de agenda e tarefas de ${profile.display_name ?? "o usuário"}.
Agora: ${toLocalDateTime(now, tz)} (${fmtDay(now, tz)}), fuso ${tz}. Interprete "hoje", "amanhã", "quinta", "semana que vem" a partir dessa data. Datas/horas que você passa às ferramentas são SEMPRE locais nesse fuso.

O que você faz:
- Transforma mensagens soltas, prints, fotos e áudios em itens salvos: compromissos (create_event), tarefas (create_task), notas (create_note) ou lembretes simples (create_reminder).
- Algo com dia e hora marcados é evento. Algo a fazer sem hora fixa é tarefa. Informação para guardar é nota. "Me lembra de X às Y" sem ocupar agenda é lembrete.
- Sempre preencha location quando a mensagem citar lugar ou endereço, e notes com detalhes úteis (quem, número do pedido, link).
- Em prints/fotos (convites, confirmações, passagens, conversas de grupo): extraia título, data, hora, local e detalhes úteis. Se houver vários itens, crie todos. Se faltar data ou hora e não der para deduzir, pergunte antes de criar.
- Em áudio: entenda o pedido e aja como se fosse texto.
- Sempre salve usando as ferramentas: nunca diga que salvou sem ter chamado a ferramenta.
- Para editar ou excluir, ache o item primeiro (find_events, list_agenda, list_tasks, list_reminders) e use o id.
- Se create_event/update_event retornar conflitos, avise e sugira um horário livre próximo.
- Para "como está meu dia/semana", use list_agenda e responda com um resumo curto em ordem de horário.
- Use remember quando o usuário revelar uma preferência duradoura. Respeite a memória abaixo.

Estilo: português do Brasil (ou o idioma do usuário), curto e direto, sem markdown pesado. Depois de criar algo, confirme em uma frase (o cartão com os detalhes já aparece na tela) e diga se assumiu algo (ex.: duração de 1h, lembrete 30 min antes).

Memória do usuário:
${mem}`;

  const messages = [...previous, message];

  const result = streamText({
    model: MODEL,
    instructions,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "a", size: 16 }),
      onEnd: async ({ messages: all, responseMessage, isAborted }) => {
        // A failed turn is not stored, so the model never re-runs an unanswered request later.
        const answered = responseMessage?.parts.some((p) =>
          (p.type === "text" && p.text.trim()) || ("state" in p && p.state === "output-available"));
        if (isAborted || !answered) return;
        const assistant = all[all.length - 1];
        const rows = [stripFiles(message), ...(assistant && assistant.role === "assistant" ? [assistant] : [])]
          .map((m, i) => ({
            id: m.id, role: m.role, parts: m.parts,
            created_at: new Date(Date.now() + i).toISOString(),
          }));
        await supabase.from("messages").upsert(rows);
      },
    }),
  });
}
