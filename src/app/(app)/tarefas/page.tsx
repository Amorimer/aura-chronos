import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { Tasks } from "@/components/tasks";

export default async function TasksPage() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId!);
  return <Tasks tz={profile.timezone} />;
}
