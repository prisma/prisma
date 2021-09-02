import { drawBox, isCurrentBinInstalledGlobally, logger } from '@prisma/sdk'
import chalk from 'chalk'
import { Check } from 'checkpoint-client'

const isPrismaInstalledGlobally = isCurrentBinInstalledGlobally()

export function printUpdateMessage(checkResult: {
  status: 'ok'
  data: Check.Response
}): void {
  let boxHeight = 4
  let majorText = ''
  if (checkResult.data.previous_version.split('.')[0] < checkResult.data.current_version.split('.')[0]) {
    majorText = `\nThis is a major update - please follow the guide at\nhttps://pris.ly/d/major-version-upgrade\n\n`
    boxHeight = boxHeight + 4
  }
  let boxText = `\n${chalk.blue('Update available')} ${
    checkResult.data.previous_version
  } -> ${checkResult.data.current_version}\n${majorText}Run the following to update
${chalk.bold(
makeInstallCommand(checkResult.data.package, checkResult.data.release_tag),
)}
${chalk.bold(
makeInstallCommand('@prisma/client', checkResult.data.release_tag, {
  canBeGlobal: false,
  canBeDev: false,
}),
)}`
  console.error(
    drawBox({
      height: boxHeight,
      width: 59,
      str: boxText,
      horizontalPadding: 2,
    }),
  )
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
  // always output tag (so major upgrades work)
  command += `@${tag}`

  return command
}
