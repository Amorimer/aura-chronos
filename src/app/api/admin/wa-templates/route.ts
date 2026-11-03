import { TEMPLATES, WABA_ID, templateDefinition } from "@/lib/wa-templates";

// Submits the WhatsApp templates for approval (idempotent) and reports their status.
// Called from the database with the cron secret, so no key leaves the server.
const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" };

  const list = await fetch(`${API}/${WABA_ID}/message_templates?fields=name,status,category,rejected_reason,language&limit=100`, { headers: auth }).then((r) => r.json());
  const existing = new Map<string, { status: string; category: string; rejected_reason?: string }>(
    (list.data ?? []).map((t: { name: string; status: string; category: string; rejected_reason?: string }) => [t.name, t]));

  const results: Record<string, unknown> = {};
  for (const d of Object.values(TEMPLATES)) {
    const cur = existing.get(d.name);
    if (cur) { results[d.name] = cur; continue; }
    const r = await fetch(`${API}/${WABA_ID}/message_templates`, { method: "POST", headers: auth, body: JSON.stringify(templateDefinition(d)) });
    results[d.name] = { created: r.ok, ...(await r.json().catch(() => ({}))) };
  }
  return Response.json({ listError: list.error?.message, results });
}
