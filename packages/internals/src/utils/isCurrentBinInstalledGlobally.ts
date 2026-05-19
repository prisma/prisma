import fs from 'fs'
import globalDirectories from 'global-directory'
import path from 'path'

export type GlobalPackageManager = 'npm' | 'yarn' | 'pnpm'

// returns which package manager installed the current prisma bin globally, or false if it is not global
export function isCurrentBinInstalledGlobally(): GlobalPackageManager | false {
  let realPrismaPath: string
  try {
    realPrismaPath = fs.realpathSync(process.argv[1])
  } catch {
    return false
  }

  const startsWith = (prefix: string): boolean => {
    try {
      return realPrismaPath.indexOf(fs.realpathSync(prefix)) === 0
    } catch {
      return false
    }
  }

  if (startsWith(globalDirectories.npm.packages)) {
    return 'npm'
  }

  if (startsWith(globalDirectories.yarn.packages)) {
    return 'yarn'
  }

  // pnpm installs global bins under `$PNPM_HOME` (set by `pnpm setup`). Fall back to the
  // default locations pnpm uses on macOS/Linux/Windows when `PNPM_HOME` is not exported.
  const pnpmCandidates = [
    process.env.PNPM_HOME,
    process.env.XDG_DATA_HOME && path.join(process.env.XDG_DATA_HOME, 'pnpm'),
    process.env.HOME && path.join(process.env.HOME, '.local', 'share', 'pnpm'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'pnpm'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'pnpm'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of pnpmCandidates) {
    if (startsWith(candidate)) {
      return 'pnpm'
    }
  }

  return false
}
