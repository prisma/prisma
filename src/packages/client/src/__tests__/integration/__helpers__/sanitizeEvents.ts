export function sanitizeEvents(e: any[]) {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  return e.map(({ duration, timestamp, ...event }) => event)
}
