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
 * The session is created without sending any email and is revoked by `done()`.
 */
export async function clientAsUser(userId: string): Promise<{ supabase: SupabaseClient; done: () => Promise<void> } | null> {
  const admin = adminClient();
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u.user?.email;
  if (!email) return null;
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties?.hashed_token) return null;
  const supabase = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, opts);
  const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (e2) return null;
  return { supabase, done: async () => { await supabase.auth.signOut({ scope: "local" }).catch(() => {}); } };
}
