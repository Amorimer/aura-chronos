"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient, adminConfigured } from "@/lib/supabase/admin";

export type DeleteState = { error?: string };

/**
 * Deletes the signed-in user's account and every row tied to it.
 * All public tables reference auth.users with ON DELETE CASCADE, so removing the auth user
 * removes events, tasks, notes, reminders, memories, messages, push subscriptions,
 * the WhatsApp link and the server-held WhatsApp session in one step.
 */
export async function deleteAccount(_: DeleteState, form: FormData): Promise<DeleteState> {
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return { error: "Digite EXCLUIR para confirmar." };
  }
  if (!adminConfigured()) return { error: "Exclusão indisponível agora. Escreva para o contato da Política de Privacidade." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) redirect("/login");

  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteAccount failed", userId, error.message);
    return { error: "Não foi possível excluir agora. Tente de novo em alguns minutos." };
  }
  // The auth user is gone; clear the browser's cookies too.
  await supabase.auth.signOut().catch(() => {});
  redirect("/login?conta=excluida");
}
