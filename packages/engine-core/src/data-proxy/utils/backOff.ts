const BACKOFF_INTERVAL = 50

export function backOff(n: number): Promise<number> {
  const baseDelay = Math.pow(2, n) * BACKOFF_INTERVAL
  const jitter = Math.ceil(Math.random() * baseDelay) - Math.ceil(baseDelay / 2)
  const total = baseDelay + jitter

  return new Promise((done) => setTimeout(() => done(total), total))
}
