import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { Agenda } from "@/components/agenda";

export default async function AgendaPage() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId!);
  return <Agenda tz={profile.timezone} />;
}
