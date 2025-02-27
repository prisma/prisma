export type QueryEvent = {
  timestamp: Date
  query: string
  params: unknown[]
  duration: number
}
