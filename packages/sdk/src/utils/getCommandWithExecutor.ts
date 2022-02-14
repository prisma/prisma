import { isCurrentBinInstalledGlobally } from './isCurrentBinInstalledGlobally'

export function getCommandWithExecutor(command: string): string {
  // if current prisma bin is from a global dir
  if (isCurrentBinInstalledGlobally()) {
    // do nothing!
    return command
  } else {
    // Example yarn 'yarn/1.22.4 npm/? node/v12.14.1 darwin x64'
    const yarnUsed = process.env.npm_config_user_agent?.includes('yarn')
    // When running in npx, npm puts this package into a /_npx/ folder. Tested on Win, Mac, Linux
    const npxUsed = __dirname.includes('_npx')
    if (npxUsed) {
      return `npx ${command}`
    } else if (yarnUsed) {
      return `yarn ${command}`
    } else {
      return command
    }
  }
}
