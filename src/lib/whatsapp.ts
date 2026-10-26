// WhatsApp Cloud API (official, by Meta). One business number sends to each user who linked their own WhatsApp.
import { toWhatsApp } from "./rich-text";
// Inside the 24h customer-service window a free-form text goes out; outside it Meta only accepts an approved template.

const API = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}`;

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// Brazilian mobiles: WhatsApp IDs often drop the 9th digit (55 21 6515-8676), but the
// test number's allowed list and the API expect it (55 21 96515-8676). Put it back.
export function normalizeTo(to: string) {
  const d = to.replace(/\D/g, "");
  if (/^55\d{2}[6-9]\d{7}$/.test(d)) return d.slice(0, 4) + "9" + d.slice(4);
  return d;
}

async function post(body: { to: string } & Record<string, unknown>) {
  body = { ...body, to: normalizeTo(body.to) };
  const res = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...(body as object) }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/** Blue ticks plus the "typing…" indicator while the assistant thinks. */
export async function markReadTyping(messageId: string) {
  await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
  }).catch(() => {});
}

/** Downloads a photo, voice note or document someone sent us. */
export async function downloadMedia(mediaId: string): Promise<{ data: Uint8Array; mediaType: string } | null> {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = await fetch(`${API}/${mediaId}`, { headers: auth }).then((r) => r.json()).catch(() => null);
  if (!meta?.url) return null;
  if (meta.file_size && meta.file_size > 15_000_000) return null;
  const res = await fetch(meta.url, { headers: auth });
  if (!res.ok) return null;
  return { data: new Uint8Array(await res.arrayBuffer()), mediaType: (meta.mime_type || "application/octet-stream").split(";")[0] };
}

export async function sendWhatsAppText(to: string, text: string) {
  return post({ to, type: "text", text: { body: toWhatsApp(text).slice(0, 4000), preview_url: true } });
}

export async function sendWhatsAppTemplate(to: string, name: string, lang: string) {
  return post({ to, type: "template", template: { name, language: { code: lang } } });
}

/**
 * A reminder or notice. `window` says whether the user wrote to us in the last ~23h.
 * Template (outside the window): WHATSAPP_TEMPLATE with two body variables: {{1}} title, {{2}} details.
 */
export async function sendWhatsAppNotice(opts: { to: string; title: string; body: string; url?: string; window: boolean }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = opts.url && appUrl ? `${appUrl}${opts.url}` : "";
  if (opts.window) {
    const text = `⏰ *${opts.title}*${opts.body ? `\n${opts.body}` : ""}${link ? `\n${link}` : ""}`;
    return sendWhatsAppText(opts.to, text);
  }
  const template = process.env.WHATSAPP_TEMPLATE;
  if (!template) return { ok: false, status: 0, json: { skipped: "window closed and no WHATSAPP_TEMPLATE set" } };
  return post({
    to: opts.to,
    type: "template",
    template: {
      name: template,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: opts.title.slice(0, 200) },
          { type: "text", text: (opts.body || "agora").slice(0, 300) },
        ],
      }],
    },
  });
}

/** Meta signs every webhook call with the app secret (X-Hub-Signature-256). */
export async function validSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
