/** Only allow same-site relative redirects, to prevent open redirects. */
export function safeNextPath(next: string | null | undefined, fallback = "/today") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
