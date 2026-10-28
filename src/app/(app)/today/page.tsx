import { requireOnboardedProfile } from "@/lib/auth/session";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  await requireOnboardedProfile();
  return (
    <main>
      <h1 className="text-2xl font-bold">Today</h1>
      <p className="mt-2 text-muted-foreground">Your workouts will appear here once your plan is generated.</p>
    </main>
  );
}
