import { drawBox, isCurrentBinInstalledGlobally, logger } from '@prisma/sdk'
import chalk from 'chalk'
import { Check } from 'checkpoint-client'

const isPrismaInstalledGlobally = isCurrentBinInstalledGlobally()

export function printUpdateMessage(checkResult: {
  status: 'ok'
  data: Check.Response
}): void {
  console.error(
    drawBox({
      height: 4,
      width: 59,
      str: `\n${chalk.blue('Update available')} ${
        checkResult.data.previous_version
      } -> ${checkResult.data.current_version}\nRun the following to update
  ${chalk.bold(
    makeInstallCommand(checkResult.data.package, checkResult.data.release_tag),
  )}
  ${chalk.bold(
    makeInstallCommand('@prisma/client', checkResult.data.release_tag, {
      canBeGlobal: false,
      canBeDev: false,
    }),
  )}`,
      horizontalPadding: 2,
    }),
  )
}

export function makeUninstallCommand(
  packageName: string,
  tag: string,
  options = {
    canBeGlobal: true,
    canBeDev: true,
  },
): string {
  // Examples
  // yarn 'yarn/1.22.4 npm/? node/v12.14.1 darwin x64'
  // npm 'npm/6.14.7 node/v12.14.1 darwin x64'
  const yarnUsed = process.env.npm_config_user_agent?.includes('yarn')

  let command = ''
  if (isPrismaInstalledGlobally === 'yarn' && options.canBeGlobal) {
    command = `yarn global remove ${packageName}`
  } else if (isPrismaInstalledGlobally === 'npm' && options.canBeGlobal) {
    command = `npm remove -g ${packageName}`
  } else if (yarnUsed && options.canBeDev) {
    command = `yarn remove ${packageName}`
  } else if (options.canBeDev) {
    command = `npm remove ${packageName}`
  } else if (yarnUsed) {
    command = `yarn remove ${packageName}`
  } else {
    command = `npm remove ${packageName}`
  }
  if (tag && tag !== 'latest') {
    command += `@${tag}`
  }

  return command
}

/**
 * Users of `@prisma/cli` will be pointed to `prisma`
 */
export function printPrismaCliUpdateWarning() {
  logger.error(`${chalk.bold(
    '@prisma/cli',
  )} package has been renamed to ${chalk.bold('prisma')}.
Please uninstall ${chalk.bold('@prisma/cli')}: ${makeUninstallCommand(
    '@prisma/cli',
    'latest',
    {
      canBeGlobal: true,
      canBeDev: false,
    },
  )}
And install ${chalk.bold.greenBright('prisma')}: ${makeInstallCommand(
    'prisma',
    'latest',
    {
      canBeGlobal: true,
      canBeDev: true,
    },
  )}\n`)

  process.exit(1)
}

function makeInstallCommand(
  packageName: string,
  tag: string,
  options = {
    canBeGlobal: true,
    canBeDev: true,
  },
): string {
  // Examples
  // yarn 'yarn/1.22.4 npm/? node/v12.14.1 darwin x64'
  // npm 'npm/6.14.7 node/v12.14.1 darwin x64'
  const yarnUsed = process.env.npm_config_user_agent?.includes('yarn')

  let command = ''
  if (isPrismaInstalledGlobally === 'yarn' && options.canBeGlobal) {
    command = `yarn global add ${packageName}`
  } else if (isPrismaInstalledGlobally === 'npm' && options.canBeGlobal) {
    command = `npm i -g ${packageName}`
  } else if (yarnUsed && options.canBeDev) {
    command = `yarn add --dev ${packageName}`
  } else if (options.canBeDev) {
    command = `npm i --save-dev ${packageName}`
  } else if (yarnUsed) {
    command = `yarn add ${packageName}`
  } else {
    command = `npm i ${packageName}`
  }
  if (tag && tag !== 'latest') {
    command += `@${tag}`
  }

  return command
}
