import { generateText, isStepCount, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 120;

// Signed-in only: times a model on a small tool-calling task, to pick the fastest one that works.
export async function GET(req: Request) {
  const { userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const model = new URL(req.url).searchParams.get("model") || "gemini-flash-lite-latest";
  const t0 = Date.now();
  try {
    const r = await generateText({
      model: google(model),
      instructions: "Hoje é 2026-10-22 (quinta). Use a ferramenta para criar o lembrete e depois confirme em uma frase.",
      prompt: "Me lembra de tomar água amanhã às 9h",
      tools: {
        create_reminder: tool({
          description: "Cria um lembrete",
          inputSchema: z.object({ title: z.string(), at: z.string().describe("YYYY-MM-DDTHH:mm local") }),
          execute: async (i) => ({ ok: true, ...i }),
        }),
      },
      stopWhen: isStepCount(3),
    });
    return Response.json({ model, ms: Date.now() - t0, steps: r.steps.length, text: r.text, calls: r.steps.flatMap((s) => s.toolCalls.map((c) => c.input)) });
  } catch (e) {
    return Response.json({ model, ms: Date.now() - t0, error: String(e).slice(0, 400) }, { status: 500 });
  }
}
