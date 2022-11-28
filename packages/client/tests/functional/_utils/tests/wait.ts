import { delay } from './delay'

export async function wait(cb: () => void | Promise<void>, ms = 100) {
  await delay(ms)

  return cb()
}
