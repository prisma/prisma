import { warn } from './logger'

const alreadyWarned = new Set()

export const warnOnce = (key: string, message: string, ...args: unknown[]) => {
  if (!alreadyWarned.has(key)) {
    alreadyWarned.add(key)
    warn(message, ...args)
  }
}
