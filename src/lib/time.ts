// Time zone helpers with no dependencies. All storage is UTC; display is in the user's zone.

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export type LocalParts = { y: number; m: number; d: number; hh: number; mm: number; ss: number; dow: number };
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(date: Date, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const x of partsFmt(tz).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second, dow: DOW[p.weekday] ?? 0 };
}

function offsetMs(date: Date, tz: string) {
  const p = localParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-23T15:00" (or "2026-10-23") in zone tz -> UTC Date. Strings with an explicit offset are parsed as-is. */
export function localToUtc(local: string, tz: string): Date {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(local)) return new Date(local);
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) throw new Error(`data inválida: ${local}`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, "0");
export function toLocalDate(date: Date, tz: string) {
  const p = localParts(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
export function toLocalDateTime(date: Date, tz: string) {
  const p = localParts(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}
export function addDaysToDate(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function dayRange(day: string, tz: string, days = 1) {
  return { from: localToUtc(day, tz), to: localToUtc(addDaysToDate(day, days), tz) };
}

export function fmtTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}
export function fmtDay(date: Date, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(date);
}
export function fmtDateTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
