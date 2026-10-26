import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function adminConfigured() {
  return !!process.env.SUPABASE_SECRET_KEY;
}

/** Full-access client. Server only; never send its key to the browser. */
export function adminClient() {
  return createClient(URL, process.env.SUPABASE_SECRET_KEY!, opts);
}

/**
 * A client signed in as `userId`, so row level security applies exactly as in the app.
 * Used where the request comes from WhatsApp instead of the user's browser.
 *
 * The session is kept server-side in `wa_sessions` and renewed with its refresh token, so a
 * magic link is only minted when no usable session exists. Minting one per message would
 * replace any login link the user was just sent and hit the per-IP verify limit.
 */
export async function clientAsUser(userId: string): Promise<{ supabase: SupabaseClient; done: () => Promise<void> } | null> {
  const admin = adminClient();
  const supabase = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, opts);
  const save = async (refresh_token: string) => {
    const { error } = await admin.from("wa_sessions")
      .upsert({ user_id: userId, refresh_token, updated_at: new Date().toISOString() });
    if (error) console.error("wa_sessions save failed", userId, error.message);
  };

  const { data: row } = await admin.from("wa_sessions").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (row?.refresh_token) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: row.refresh_token });
    if (!error && data.session) {
      await save(data.session.refresh_token);
      return { supabase, done: async () => {} };
    }
    console.warn("wa_sessions refresh failed, minting a new session", userId, error?.message);
  }

  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u.user?.email;
  if (!email) return null;
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties?.hashed_token) {
    console.error("generateLink failed", userId, error?.message);
    return null;
  }
  const { data: verified, error: e2 } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (e2 || !verified.session) {
    console.error("verifyOtp failed", userId, e2?.message);
    return null;
  }
  await save(verified.session.refresh_token);
  return { supabase, done: async () => {} };
}

/** Forget the server-held session (WhatsApp disconnected or account deleted). */
export async function dropServiceSession(userId: string) {
  await adminClient().from("wa_sessions").delete().eq("user_id", userId);
}
