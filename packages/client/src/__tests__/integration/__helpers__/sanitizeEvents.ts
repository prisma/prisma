export function sanitizeEvents(e: any[]) {
  return e.map(({ duration, timestamp, ...event }) => event)
}
