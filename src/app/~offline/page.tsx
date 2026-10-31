import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

// Served by the service worker when a page isn't available offline.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">You&rsquo;re offline</h1>
      <p className="text-muted-foreground">
        This page needs a connection. Workouts you&rsquo;ve started still work offline and sync when you&rsquo;re back.
      </p>
      <Link href="/today" className="text-primary underline underline-offset-2">
        Go to Today
      </Link>
    </main>
  );
}
