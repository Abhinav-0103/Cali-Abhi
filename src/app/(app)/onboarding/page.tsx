import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { DisclaimerFooter } from "@/components/disclaimer";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const { profile } = await getProfile();
  if (profile.onboarding_completed_at) redirect("/today");

  return (
    <main>
      <header className="mb-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">CaliCoach</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <OnboardingWizard />
      <DisclaimerFooter />
    </main>
  );
}
