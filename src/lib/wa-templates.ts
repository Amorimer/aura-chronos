// WhatsApp message templates: the only messages Meta accepts outside the 24h window.
// Each template is submitted once for approval (category UTILITY, pt_BR). Their quick-reply
// buttons carry the same "act:..." payloads as the in-window buttons, set per send.
import type { WaButton } from "./wa-buttons";

export const WABA_ID = process.env.WHATSAPP_WABA_ID || "1154646770267612";
export const LANG = process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR";

type Def = { name: string; text: string; example: string[]; buttons: string[] };

export const TEMPLATES: Record<"reminder" | "brief" | "briefDay", Def> = {
  reminder: {
    name: "aura_lembrete",
    text: "Lembrete do Aura Cronos: *{{1}}*\n{{2}}\n\nToque abaixo para concluir ou adiar.",
    example: ["Reunião com a Carla", "Em 30 min · Escritório"],
    buttons: ["Concluído", "Adiar"],
  },
  brief: {
    name: "aura_resumo",
    text: "Bom dia! Este é o resumo do seu dia no Aura Cronos:\n{{1}}\n\nToque abaixo para concluir, adiar ou ver tudo.",
    example: ["2 compromissos. Primeiro: 09:00 Reunião com a Carla. 2 tarefas em aberto."],
    buttons: ["Concluído", "Adiar", "Ver o dia"],
  },
  briefDay: {
    name: "aura_resumo_dia",
    text: "Bom dia! Este é o resumo do seu dia no Aura Cronos:\n{{1}}\n\nToque abaixo para ver tudo.",
    example: ["Nenhum compromisso hoje. 3 tarefas em aberto."],
    buttons: ["Ver o dia"],
  },
};

/** Body for POST /{waba}/message_templates. */
export function templateDefinition(d: Def) {
  return {
    name: d.name,
    language: LANG,
    category: "UTILITY",
    components: [
      { type: "BODY", text: d.text, example: { body_text: [d.example] } },
      { type: "BUTTONS", buttons: d.buttons.map((text) => ({ type: "QUICK_REPLY", text })) },
    ],
  };
}

/** Template parameters cannot have line breaks, tabs or long runs of spaces. */
export function param(s: string, max = 900) {
  return (s || "-").replace(/[\n\t]+/g, " · ").replace(/ {4,}/g, " ").trim().slice(0, max) || "-";
}

/**
 * Picks the template for a notice outside the window and builds the send payload.
 * The in-window buttons decide which one: Concluído/Adiar need an item; Ver o dia alone uses the short brief.
 */
export function templateMessage(kind: "reminder" | "brief", title: string, body: string, buttons: WaButton[]) {
  const ids = buttons.map((b) => b.id);
  const item = ids.filter((id) => id.startsWith("act:done:") || id.startsWith("act:snooze:"));
  let def: Def;
  let payloads: string[];
  let params: string[];
  if (kind === "reminder") {
    def = TEMPLATES.reminder;
    payloads = item.length === 2 ? item : [];
    params = [param(title, 200), param(body || "Agora", 300)];
  } else if (item.length === 2) {
    def = TEMPLATES.brief;
    payloads = [...item, "act:day"];
    params = [param(body)];
  } else {
    def = TEMPLATES.briefDay;
    payloads = ["act:day"];
    params = [param(body)];
  }
  const components: Record<string, unknown>[] = [
    { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
    ...payloads.map((payload, i) => ({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload }] })),
  ];
  return { name: def.name, language: { code: LANG }, components };
}
