/** A publication day inside a year group: the group's heading already supplies the year. */
export function dayWithoutYear(date: string, locale: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
