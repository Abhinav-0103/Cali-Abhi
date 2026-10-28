import { PlanGenerator } from "@/components/plan/plan-generator";
import { requireOnboardedProfile } from "@/lib/auth/session";

export const metadata = { title: "Building your plan" };

export default async function GeneratingPage() {
  await requireOnboardedProfile();
  return (
    <main>
      <PlanGenerator />
    </main>
  );
}
