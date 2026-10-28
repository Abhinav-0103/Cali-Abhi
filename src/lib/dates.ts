/** The calendar date (YYYY-MM-DD) in the given IANA time zone. */
export function dateInTimeZone(timeZone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
