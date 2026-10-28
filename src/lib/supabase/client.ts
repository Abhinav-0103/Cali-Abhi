import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./public-env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client (user session, RLS enforced). Singleton per tab. */
export function createClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
