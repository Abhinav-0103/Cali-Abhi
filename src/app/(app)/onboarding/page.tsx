import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { DisclaimerFooter } from "@/components/disclaimer";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const { profile } = await getProfile();
  if (profile.onboarding_completed_at) redirect("/today");

  return (
    <main>
      <header className="mb-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">CaliCoach</span>
        <SignOutButton variant="link" />
      </header>
      <OnboardingWizard />
      <DisclaimerFooter />
    </main>
  );
}
