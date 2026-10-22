import type { UIMessage } from "ai";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { Chat } from "@/components/chat";

export default async function AssistantPage() {
  const { supabase, userId } = await requireUser();
  const [profile, { data }] = await Promise.all([
    getProfile(supabase, userId!),
    supabase.from("messages").select("id,role,parts").order("created_at", { ascending: false }).limit(40),
  ]);
  const initial = ((data ?? []) as UIMessage[]).reverse();
  return <Chat initialMessages={initial} assistantName={profile.assistant_name} userName={profile.display_name ?? ""} />;
}
