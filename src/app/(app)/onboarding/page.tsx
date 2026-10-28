import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const { profile } = await getProfile();
  if (profile.onboarding_completed_at) redirect("/today");
  return (
    <main>
      <h1 className="text-2xl font-bold">Welcome to CaliCoach</h1>
      <p className="mt-2 text-muted-foreground">The onboarding questionnaire arrives in phase 2.</p>
    </main>
  );
}
