import { headers } from "next/headers";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { Settings } from "@/components/settings";

export default async function SettingsPage() {
  const { supabase, userId } = await requireUser();
  const [profile, mem, user] = await Promise.all([
    getProfile(supabase, userId!),
    supabase.from("memories").select("id,fact").order("created_at"),
    supabase.auth.getUser(),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return <Settings profile={profile} memories={mem.data ?? []} email={user.data.user?.email ?? ""} feedUrl={`${origin}/api/feed/${profile.feed_token}.ics`} />;
}
