import { isCurrentBinInstalledGlobally } from './isCurrentBinInstalledGlobally'

export function getCommandWithExecutor(command: string): string {
  // if current prisma bin is from a global dir
  if (isCurrentBinInstalledGlobally()) {
    // do nothing!
    return command
  }
    // When running in npx, npm puts this package into a /_npx/ folder. Tested on Win, Mac, Linux
    const npxUsed = __dirname.includes('_npx')
    if (npxUsed) {
      return `npx ${command}`
    }
      return command
}
