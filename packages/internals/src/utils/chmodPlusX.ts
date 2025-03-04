import Debug from '@prisma/debug'
import fs from 'node:fs'

const debug = Debug('chmodPlusX')

export function chmodPlusX(file: string): void {
  // Note: skip for windows as chmod does on exist there
  // and will error with `EACCES: permission denied`
  if (process.platform === 'win32') return

  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    debug(`Execution permissions of ${file} are fine`)
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  debug(`Have to call chmodPlusX on ${file}`)
  fs.chmodSync(file, base8)
}
