import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { DisclaimerFooter } from "@/components/disclaimer";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getUser()) redirect("/today");
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Sign in to CaliCoach</h1>
      <p className="mb-6 text-sm text-muted-foreground">We&rsquo;ll email you a magic link, no password needed.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} initialError={typeof error === "string" ? error : undefined} />
      <DisclaimerFooter />
    </main>
  );
}
