import fs from 'node:fs'
import globalDirectories from 'global-dirs'

// returns if current prisma bin is installed globally
export function isCurrentBinInstalledGlobally(): 'npm' | false {
  try {
    const realPrismaPath = fs.realpathSync(process.argv[1])
    const usingGlobalNpm = realPrismaPath.indexOf(fs.realpathSync(globalDirectories.npm.packages)) === 0

    if (usingGlobalNpm) {
      return 'npm'
    }
  } catch (_e) {
    //
  }
  return false
}
