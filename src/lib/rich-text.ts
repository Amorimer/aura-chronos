/**
 * The assistant writes WhatsApp-style emphasis (*bold*), and models sometimes slip into
 * Markdown (**bold**). Both channels share one history, so both forms must read cleanly.
 */

export type Run = { text: string; bold: boolean };

const BOLD = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;

/** Split text into plain and bold runs; unmatched asterisks stay as typed. */
export function boldRuns(s: string): Run[] {
  const out: Run[] = [];
  let last = 0;
  for (const m of s.matchAll(BOLD)) {
    const inner = m[1] ?? m[2];
    if (!inner.trim()) continue;
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: inner, bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

/** WhatsApp bolds with one asterisk; turn Markdown's double asterisks into that. */
export function toWhatsApp(s: string): string {
  return s.replace(/\*\*([^*\n]+?)\*\*/g, "*$1*");
}
