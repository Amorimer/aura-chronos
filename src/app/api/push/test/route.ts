import webpush from "web-push";
import { requireUser } from "@/lib/supabase/server";

export async function POST() {
  const { supabase, userId } = await requireUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const { data } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth").is("failed_at", null);
  let sent = 0;
  for (const s of data ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Aura Chronos", body: "Notificações funcionando. É assim que seus lembretes vão chegar.", tag: "test", url: "/ajustes" }),
      );
      sent++;
    } catch {
      // ignore: the cron marks dead subscriptions
    }
  }
  return Response.json({ sent });
}
