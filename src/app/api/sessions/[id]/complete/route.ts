import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { processSession } from "@/lib/progression/run";
import { createClient } from "@/lib/supabase/server";

/**
 * Called after a completed workout has synced. Runs the progression engine
 * once for the session and returns the plan changes it made (if any).
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/sessions/[id]/complete">) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  try {
    const changes = await processSession(user.id, id.data);
    return NextResponse.json({ changes });
  } catch (error) {
    console.error("progression failed", error);
    return NextResponse.json({ error: "Couldn't update your plan right now." }, { status: 500 });
  }
}
