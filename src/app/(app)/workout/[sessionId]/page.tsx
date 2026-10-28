import { WorkoutLogger } from "@/components/workout/workout-logger";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: PageProps<"/workout/[sessionId]">) {
  const [{ user }, { sessionId }] = await Promise.all([requireUser(), params]);
  return (
    <main>
      <WorkoutLogger sessionId={sessionId} userId={user.id} />
    </main>
  );
}
