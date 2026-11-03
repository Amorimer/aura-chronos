import { requireUser } from "@/lib/supabase/server";
import { adminClient, adminConfigured } from "@/lib/supabase/admin";
import { sendWhatsAppNotice, whatsappConfigured } from "@/lib/whatsapp";
import { noticeButtons } from "@/lib/wa-buttons";

/** "Enviar teste" in Ajustes: sends today's summary exactly as the morning brief, buttons included. */
export async function POST() {
  const { supabase, userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  if (!whatsappConfigured()) return Response.json({ ok: false, reason: "not_configured" });
  const { data: p } = await supabase.from("profiles")
    .select("whatsapp_phone,whatsapp_last_inbound_at").eq("id", userId).single();
  if (!p?.whatsapp_phone) return Response.json({ ok: false, reason: "not_linked" });
  const window = !!p.whatsapp_last_inbound_at && Date.now() - new Date(p.whatsapp_last_inbound_at).getTime() < 23 * 3600e3;

  let body = "É assim que seus lembretes vão chegar.";
  let ref: string | null = null;
  let brief: { events: number; tasks: number } | null = null;
  if (adminConfigured()) {
    const { data } = await adminClient().rpc("wa_day_items", { p_user: userId });
    const items = (data ?? []) as { kind: string; id: string; at_label: string; title: string }[];
    const events = items.filter((i) => i.kind === "e");
    const tasks = items.filter((i) => i.kind === "t").length;
    const first = events[0];
    body = (events.length === 0 ? "Nenhum compromisso hoje."
      : events.length === 1 ? `1 compromisso: ${first.at_label} ${first.title}.`
      : `${events.length} compromissos. Primeiro: ${first.at_label} ${first.title}.`)
      + (tasks ? ` ${tasks} tarefa${tasks > 1 ? "s" : ""} em aberto.` : "");
    ref = first ? `e:${first.id}` : null;
    brief = { events: events.length, tasks };
  }
  const r = await sendWhatsAppNotice({
    to: p.whatsapp_phone, title: "Teste: seu dia", body, url: "/agenda", window,
    buttons: noticeButtons(ref, brief),
  });
  return Response.json({ ok: r.ok, window, detail: r.ok ? undefined : r.json });
}
