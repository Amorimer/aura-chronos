import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { SwRegister } from "@/components/sw-register";

async function Gate({ children }: { children: React.ReactNode }) {
  const { userId } = await requireUser();
  if (!userId) redirect("/login");
  return <>{children}</>;
}

function Loading() {
  return (
    <div className="flex-1 px-4 pt-[calc(56px+env(safe-area-inset-top))] flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-surface-2 animate-pulse" />)}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh max-w-xl mx-auto flex flex-col">
      <div className="flex-1 flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Loading />}>
          <Gate>{children}</Gate>
        </Suspense>
      </div>
      <BottomNav />
      <SwRegister />
    </div>
  );
}
