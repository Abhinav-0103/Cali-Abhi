import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DisclaimerFooter } from "@/components/disclaimer";
import { getUser } from "@/lib/supabase/server";

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  if (await getUser()) redirect("/today");
  const { deleted } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="space-y-4">
        {deleted && (
          <p role="status" className="rounded-md border p-3 text-sm">
            Your account and all your data have been deleted.
          </p>
        )}
        <p className="text-sm font-medium text-primary">CaliCoach</p>
        <h1 className="text-4xl font-bold tracking-tight">Bodyweight training that adapts to you.</h1>
        <p className="text-muted-foreground">
          Answer a 2-minute questionnaire and get a 4-week calisthenics plan built around your goal, equipment and
          schedule. Log your sets and it progresses with you.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Get started</Link>
        </Button>
      </div>
      <DisclaimerFooter />
    </main>
  );
}
