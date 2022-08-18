import Debug from '@prisma/debug'
import fs from 'fs'

const debug = Debug('plusX')

export function plusX(file): void {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    debug(`Execution permissions of ${file} are fine`)
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  debug(`Have to call plusX on ${file}`)
  fs.chmodSync(file, base8)
}
