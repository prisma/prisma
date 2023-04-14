import chalk from 'chalk'

import { logger } from '../../../..'
import { semverLt } from './semverLt'

// TODO: Is this well tested?

/**
 * Warn, if yarn is older than 1.19.2 because Yarn used to remove all dot
 * folders inside node_modules before. We use node_modules/.prisma/client
 * directory as default location for generated Prisma Client. Changelog
 * https://github.com/yarnpkg/yarn/blob/HEAD/CHANGELOG.md#1192
 */
export function checkYarnVersion() {
  if (process.env.npm_config_user_agent) {
    const match = parseUserAgentString(process.env.npm_config_user_agent)
    if (match) {
      const { agent, major, minor, patch } = match
      if (agent === 'yarn' && major === 1) {
        const currentYarnVersion = `${major}.${minor}.${patch}`
        const minYarnVersion = '1.19.2'
        if (semverLt(currentYarnVersion, minYarnVersion)) {
          logger.warn(
            `Your ${chalk.bold(
              'yarn',
            )} has version ${currentYarnVersion}, which is outdated. Please update it to ${chalk.bold(
              minYarnVersion,
            )} or ${chalk.bold('newer')} in order to use Prisma.`,
          )
        }
      }
    }
  }
}

function parseUserAgentString(str) {
  const userAgentRegex = /(\w+)\/(\d+)\.(\d+)\.(\d+)/
  const match = userAgentRegex.exec(str)
  if (match) {
    const agent = match[1]
    const major = parseInt(match[2])
    const minor = parseInt(match[3])
    const patch = parseInt(match[4])
    return { agent, major, minor, patch }
  }
  return null
}
