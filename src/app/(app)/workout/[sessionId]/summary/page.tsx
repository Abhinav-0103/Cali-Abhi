import { WorkoutSummary } from "@/components/workout/workout-summary";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Workout summary" };

export default async function SummaryPage({ params }: PageProps<"/workout/[sessionId]/summary">) {
  const [{ user }, { sessionId }] = await Promise.all([requireUser(), params]);
  return (
    <main>
      <WorkoutSummary sessionId={sessionId} userId={user.id} />
    </main>
  );
}
