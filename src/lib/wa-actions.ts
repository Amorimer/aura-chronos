// Buttons under WhatsApp reminders and the morning brief, and what each tap does.
// A button id is "act:<verb>:<kind>:<uuid>" or "act:day".
//   kind: e = event, t = task, r = standalone reminder
//   verb: done (Concluído), snooze (Adiar → shows next/pick), next (Próximo dia),
//         pick (Outra data → next message is the new date), item (a row picked in "Ver o dia")
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToDate, localToUtc, toLocalDate } from "./time";
import { sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppText } from "./whatsapp";
import { doneButton, snoozeButton, type Action, type Kind } from "./wa-buttons";
export { noticeButtons, parseAction } from "./wa-buttons";

type Item = { title: string; recurring: boolean; at: string | null };

async function loadItem(db: SupabaseClient, userId: string, kind: Kind, id: string): Promise<Item | null> {
  if (kind === "e") {
    const { data } = await db.from("events").select("title,recurrence,start_at").eq("id", id).eq("user_id", userId).maybeSingle();
    return data ? { title: data.title, recurring: !!data.recurrence, at: data.start_at } : null;
  }
  if (kind === "t") {
    const { data } = await db.from("tasks").select("title,due_at").eq("id", id).eq("user_id", userId).maybeSingle();
    return data ? { title: data.title, recurring: false, at: data.due_at } : null;
  }
  const { data } = await db.from("reminders").select("title,recurrence,remind_at").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? { title: data.title, recurring: !!data.recurrence, at: data.remind_at } : null;
}

const plusDay = (iso: string) => new Date(new Date(iso).getTime() + 86_400_000).toISOString();

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Tomorrow 09:00 in the user's time zone, for a task that had no date. */
function tomorrowNine(tz: string) {
  return localToUtc(`${addDaysToDate(toLocalDate(new Date(), tz), 1)}T09:00`, tz).toISOString();
}

/**
 * Runs one button tap. `db` is the service client; every query is scoped to `userId`.
 * Returns a short text describing what happened, for the chat history.
 */
export async function runAction(db: SupabaseClient, userId: string, tz: string, to: string, a: Action): Promise<string> {
  if (a.verb === "keep") {
    const msg = "Combinado 👍 Sigo te avisando dos seus compromissos por aqui.";
    await sendWhatsAppText(to, msg);
    return msg;
  }

  if (a.verb === "day") {
    const { data } = await db.rpc("wa_day_items", { p_user: userId });
    const rows = (data ?? []) as { kind: Kind; id: string; at_label: string; title: string }[];
    if (!rows.length) {
      const msg = "Nada pendente para hoje. Dia livre! 🎉";
      await sendWhatsAppText(to, msg);
      return msg;
    }
    const lines = rows.map((r) => `• ${r.at_label} · ${r.title}`).join("\n");
    const msg = `📋 *Seu dia*\n${lines}\n\nToque em "Escolher" para concluir ou adiar um item.`;
    await sendWhatsAppList(to, msg, "Escolher", rows.map((r) => ({
      id: `act:item:${r.kind}:${r.id}`, title: r.title, description: r.at_label,
    })));
    return msg;
  }

  const item = await loadItem(db, userId, a.kind, a.id);
  if (!item) {
    const msg = "Não encontrei esse item. Ele pode ter sido apagado.";
    await sendWhatsAppText(to, msg);
    return msg;
  }

  if (a.verb === "item") {
    const msg = `*${item.title}*${item.at ? `\n${fmt(item.at, tz)}` : ""}`;
    await sendWhatsAppButtons(to, msg, [doneButton(a.kind, a.id), snoozeButton(a.kind, a.id)]);
    return msg;
  }

  if (a.verb === "snooze") {
    const msg = `Adiar *${item.title}* para quando?`;
    await sendWhatsAppButtons(to, msg, [
      { id: `act:next:${a.kind}:${a.id}`, title: "➡️ Próximo dia" },
      { id: `act:pick:${a.kind}:${a.id}`, title: "📅 Outra data" },
    ]);
    return msg;
  }

  if (a.verb === "pick" || (a.verb === "next" && item.recurring)) {
    await db.from("profiles").update({
      wa_pending: { action: "reschedule", kind: a.kind, id: a.id, title: item.title, expires: new Date(Date.now() + 30 * 60_000).toISOString() },
    }).eq("id", userId);
    const msg = item.recurring && a.verb === "next"
      ? `*${item.title}* se repete. Para qual dia e hora quer mudar só este? Ex.: "amanhã 15h".`
      : `Para quando quer passar *${item.title}*? Pode escrever ou mandar áudio, ex.: "sexta 15h" ou "dia 20 às 9h".`;
    await sendWhatsAppText(to, msg);
    return msg;
  }

  if (a.verb === "next") {
    let at: string | null = null;
    if (a.kind === "e") {
      const { data } = await db.from("events").select("start_at,end_at").eq("id", a.id).eq("user_id", userId).single();
      at = plusDay(data!.start_at);
      await db.from("events").update({ start_at: at, end_at: plusDay(data!.end_at), done_at: null }).eq("id", a.id).eq("user_id", userId);
    } else if (a.kind === "t") {
      at = item.at ? plusDay(item.at) : tomorrowNine(tz);
      await db.from("tasks").update({ due_at: at }).eq("id", a.id).eq("user_id", userId);
    } else {
      at = plusDay(item.at!);
      await db.from("reminders").update({ remind_at: at, sent_at: null }).eq("id", a.id).eq("user_id", userId);
    }
    const msg = `Feito ✅ *${item.title}* passou para ${fmt(at, tz)}.`;
    await sendWhatsAppText(to, msg);
    return msg;
  }

  // done
  if (a.kind === "t") {
    await db.from("tasks").update({ done_at: new Date().toISOString() }).eq("id", a.id).eq("user_id", userId);
  } else if (a.kind === "e" && !item.recurring) {
    await db.from("events").update({ done_at: new Date().toISOString() }).eq("id", a.id).eq("user_id", userId);
  } else if (a.kind === "r" && !item.recurring) {
    await db.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", a.id).eq("user_id", userId);
  }
  const msg = item.recurring
    ? `Concluído ✅ *${item.title}* por hoje. As próximas repetições continuam.`
    : `Concluído ✅ *${item.title}*.`;
  await sendWhatsAppText(to, msg);
  return msg;
}
