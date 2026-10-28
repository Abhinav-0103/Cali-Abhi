import Link from "next/link";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-prose space-y-4 px-6 py-10">
      <h1 className="text-2xl font-bold">Not medical advice</h1>
      <p>
        CaliCoach generates general exercise suggestions using software, including AI. It is not a doctor,
        physiotherapist or certified coach, and it does not diagnose, treat or prevent any condition.
      </p>
      <p>
        Talk to a qualified health professional before starting a new exercise programme, especially if you have a
        medical condition, an injury, are pregnant, or answered &ldquo;yes&rdquo; to any health-screening question.
      </p>
      <p>
        Stop exercising and seek medical help if you feel chest pain, dizziness, severe shortness of breath or sharp
        pain. You train at your own risk.
      </p>
      <Link href="/" className="text-primary underline underline-offset-2">
        Back
      </Link>
    </main>
  );
}
