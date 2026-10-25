import { requireUser } from "@/lib/supabase/server";
import { sendWhatsAppNotice, whatsappConfigured } from "@/lib/whatsapp";

export async function POST() {
  const { supabase, userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  if (!whatsappConfigured()) return Response.json({ ok: false, reason: "not_configured" });
  const { data: p } = await supabase.from("profiles")
    .select("whatsapp_phone,whatsapp_last_inbound_at").eq("id", userId).single();
  if (!p?.whatsapp_phone) return Response.json({ ok: false, reason: "not_linked" });
  const window = !!p.whatsapp_last_inbound_at && Date.now() - new Date(p.whatsapp_last_inbound_at).getTime() < 23 * 3600e3;
  const r = await sendWhatsAppNotice({ to: p.whatsapp_phone, title: "Teste do Aura Cronos", body: "É assim que seus lembretes vão chegar.", url: "/ajustes", window });
  return Response.json({ ok: r.ok, window, detail: r.ok ? undefined : r.json });
}
