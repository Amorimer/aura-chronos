import type { EventRow, Occurrence } from "./types";
import { localParts, localToUtc } from "./time";

const pad = (n: number) => String(n).padStart(2, "0");

function shiftLocal(start: Date, tz: string, rec: string, k: number): Date {
  const p = localParts(start, tz);
  let y = p.y, m = p.m, d = p.d;
  if (rec === "daily") d += k;
  else if (rec === "weekly") d += 7 * k;
  else if (rec === "monthly") m += k;
  else if (rec === "yearly") y += k;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (rec === "monthly" || rec === "yearly") {
    // skip months that do not have this day (e.g. the 31st)
    if (t.getUTCDate() !== p.d) return new Date(NaN);
  }
  return localToUtc(`${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(p.hh)}:${pad(p.mm)}`, tz);
}

/** Expand events (recurring or not) into occurrences that overlap [from, to). */
export function expand(events: EventRow[], from: Date, to: Date, tz: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    const start = new Date(e.start_at);
    const dur = new Date(e.end_at).getTime() - start.getTime();
    if (!e.recurrence) {
      if (start < to && new Date(start.getTime() + dur) > from) {
        out.push({ ...e, occurrence_start: e.start_at, occurrence_end: e.end_at, key: e.id });
      }
      continue;
    }
    const until = e.recurrence_until ? localToUtc(e.recurrence_until, tz).getTime() + 86400000 : Infinity;
    // jump close to the window first
    const approxStep = { daily: 1, weekly: 7, monthly: 28, yearly: 365 }[e.recurrence] * 86400000;
    let k = Math.max(0, Math.floor((from.getTime() - start.getTime() - dur) / approxStep) - 2);
    for (let guard = 0; guard < 1000; guard++, k++) {
      const s = shiftLocal(start, tz, e.recurrence, k);
      if (isNaN(s.getTime())) continue;
      if (s >= to || s.getTime() >= until) break;
      const en = new Date(s.getTime() + dur);
      if (en > from) {
        out.push({ ...e, occurrence_start: s.toISOString(), occurrence_end: en.toISOString(), key: `${e.id}:${s.toISOString()}` });
      }
    }
  }
  return out.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start));
}

/** Pairs of timed occurrences that overlap. */
export function conflictsWith(target: { start: Date; end: Date; id?: string }, occ: Occurrence[]) {
  return occ.filter(
    (o) => !o.all_day && o.id !== target.id &&
      new Date(o.occurrence_start) < target.end && new Date(o.occurrence_end) > target.start,
  );
}
