import * as fs from 'fs'
import { Platform } from '@prisma/get-platform'

export function plusX(file) {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) return
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(file, base8)
}

export function fixPlatforms(platforms: Platform[], platform: Platform) {
  platforms = platforms || []
  if (!platforms.includes('native')) {
    return ['native', ...platforms]
  }

  return [...platforms, platform]
}
