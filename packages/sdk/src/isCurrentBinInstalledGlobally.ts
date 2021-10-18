import fs from 'fs'
import globalDirectories from 'global-dirs'

// returns if current prisma bin is installed globally
export function isCurrentBinInstalledGlobally(): 'npm' | 'yarn' | false {
  try {
    const realPrismaPath = fs.realpathSync(process.argv[1])
    const usingGlobalYarn = realPrismaPath.indexOf(globalDirectories.yarn.packages) === 0
    const usingGlobalNpm = realPrismaPath.indexOf(fs.realpathSync(globalDirectories.npm.packages)) === 0

    if (usingGlobalNpm) {
      return 'npm'
    }
    if (usingGlobalYarn) {
      return 'yarn'
    } else {
      false
    }
  } catch (e) {
    //
  }
  return false
}
