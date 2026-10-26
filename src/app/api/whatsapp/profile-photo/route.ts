import { requireUser } from "@/lib/supabase/server";

// One-off admin action: sets the WhatsApp Business profile photo to /brand/whatsapp-profile.png.
const OWNER = "amorimer.designer@gmail.com";
const APP_ID = "28947980358146437";

export async function GET(req: Request) {
  const { supabase, userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const { data: u } = await supabase.auth.getUser();
  if (u.user?.email !== OWNER) return new Response("forbidden", { status: 403 });

  const token = process.env.WHATSAPP_TOKEN!;
  const api = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}`;
  const img = new Uint8Array(await (await fetch(new URL("/brand/whatsapp-profile.png", req.url))).arrayBuffer());

  const session = await fetch(`${api}/${APP_ID}/uploads?file_name=aura-cronos.png&file_length=${img.length}&file_type=image/png`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if (!session.id) return Response.json({ step: "session", session }, { status: 500 });

  const up = await fetch(`${api}/${session.id}`, {
    method: "POST", headers: { Authorization: `OAuth ${token}`, file_offset: "0" }, body: img,
  }).then((r) => r.json());
  if (!up.h) return Response.json({ step: "upload", up }, { status: 500 });

  const prof = await fetch(`${api}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_profile`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", profile_picture_handle: up.h }),
  }).then((r) => r.json());
  return Response.json({ ok: !!prof.success, prof });
}
