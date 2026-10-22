import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

type Msg = {
  tag: string; title: string; body: string; urgent: boolean; url: string;
  subs: { endpoint: string; keys: { p256dh: string; auth: string } }[];
};

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const { messages } = (await req.json()) as { messages: Msg[] };
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    (messages ?? []).flatMap((m) =>
      m.subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            s,
            JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: m.url, urgent: m.urgent }),
            { TTL: m.urgent ? 600 : 3600, urgency: m.urgent ? "high" : "normal" },
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
        }
      }),
    ),
  );
  if (dead.length) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.rpc("mark_push_failed", { p_secret: secret, p_endpoints: dead });
  }
  return Response.json({ sent, dead: dead.length });
}
