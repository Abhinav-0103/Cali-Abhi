import { BottomNav } from "@/components/bottom-nav";
import { SyncManager } from "@/components/workout/sync-manager";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-md px-4 pt-6 pb-24">{children}</div>
      <BottomNav />
      <SyncManager />
    </>
  );
}
