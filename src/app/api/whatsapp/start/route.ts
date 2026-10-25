import { requireUser } from "@/lib/supabase/server";
import { sendWhatsAppTemplate, whatsappConfigured } from "@/lib/whatsapp";

// Opens the chat from our side: a business number only becomes reachable in the person's
// WhatsApp after it has sent them a message (always true for Meta's test numbers).
const recent = new Map<string, number>();

export async function POST(req: Request) {
  const { userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  if (!whatsappConfigured()) return Response.json({ ok: false, reason: "not_configured" });
  const { phone } = await req.json().catch(() => ({}));
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return Response.json({ ok: false, reason: "invalid_phone" });
  const last = recent.get(userId) || 0;
  if (Date.now() - last < 30e3) return Response.json({ ok: false, reason: "too_soon" });
  recent.set(userId, Date.now());
  const r = await sendWhatsAppTemplate(digits, process.env.WHATSAPP_HELLO_TEMPLATE || "hello_world", process.env.WHATSAPP_HELLO_LANG || "en_US");
  if (!r.ok) console.error("whatsapp start failed", r.status, JSON.stringify(r.json));
  const code = (r.json as { error?: { code?: number } })?.error?.code;
  return Response.json({ ok: r.ok, reason: r.ok ? undefined : code === 131030 ? "not_allowed" : "send_failed" });
}
