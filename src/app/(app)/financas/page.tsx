import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { Finance } from "@/components/finance";

export const metadata = { title: "Finanças · Aura Cronos" };

export default async function FinancePage() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId!);
  return <Finance tz={profile.timezone} />;
}
