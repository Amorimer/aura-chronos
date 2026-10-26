import {
  convertToModelMessages, createIdGenerator, createUIMessageStreamResponse, isStepCount, streamText,
  toUIMessageStream, type UIMessage,
} from "ai";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { buildTools } from "@/lib/agent-tools";
import { assistantInstructions, MODEL } from "@/lib/assistant";

export const maxDuration = 120;

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

  const instructions = assistantInstructions(profile, memories.data ?? [], "app");

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
