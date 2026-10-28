import Link from "next/link";

export function DisclaimerFooter() {
  return (
    <p className="px-4 py-6 text-center text-xs text-muted-foreground">
      CaliCoach provides general fitness guidance, not medical advice.{" "}
      <Link href="/disclaimer" className="underline underline-offset-2">
        Read the full disclaimer
      </Link>
      .
    </p>
  );
}
