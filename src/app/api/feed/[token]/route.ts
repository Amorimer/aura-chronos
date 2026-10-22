import { createClient } from "@supabase/supabase-js";

const RRULE: Record<string, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" };

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function utc(d: string) {
  return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function localDate(d: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(d)).replace(/-/g, "");
}
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const id = token.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await sb.rpc("feed_events", { p_token: id });
  if (error) return new Response("error", { status: 500 });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pauta//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Pauta"];
  for (const e of data as Array<Record<string, string & boolean>>) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@pauta`, `DTSTAMP:${utc(e.updated_at)}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${localDate(e.start_at, e.timezone)}`, `DTEND;VALUE=DATE:${localDate(e.end_at, e.timezone)}`);
    } else {
      lines.push(`DTSTART:${utc(e.start_at)}`, `DTEND:${utc(e.end_at)}`);
    }
    lines.push(fold(`SUMMARY:${esc(e.title)}`));
    if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`));
    if (e.notes) lines.push(fold(`DESCRIPTION:${esc(e.notes)}`));
    if (e.recurrence) {
      lines.push(`RRULE:FREQ=${RRULE[e.recurrence]}${e.recurrence_until ? `;UNTIL=${String(e.recurrence_until).replace(/-/g, "")}T235959Z` : ""}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
