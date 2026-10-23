import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, Occurrence, Profile } from "./types";
import { expand } from "./recurrence";

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (
    (data as Profile) ?? {
      id: userId, display_name: null, assistant_name: "Aura Cronos", timezone: "America/Sao_Paulo",
      morning_brief: true, morning_brief_time: "07:30", feed_token: "",
    }
  );
}

export async function occurrencesBetween(supabase: SupabaseClient, from: Date, to: Date, tz: string): Promise<Occurrence[]> {
  const [single, recurring] = await Promise.all([
    supabase.from("events").select("*").is("recurrence", null)
      .lt("start_at", to.toISOString()).gt("end_at", from.toISOString()).order("start_at").limit(500),
    supabase.from("events").select("*").not("recurrence", "is", null).lt("start_at", to.toISOString()).limit(200),
  ]);
  if (single.error) throw single.error;
  if (recurring.error) throw recurring.error;
  return expand([...(single.data as EventRow[]), ...(recurring.data as EventRow[])], from, to, tz);
}
