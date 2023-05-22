import { drawBox, isCurrentBinInstalledGlobally } from '@prisma/internals'
import type { Check } from 'checkpoint-client'
import { blue, bold } from 'kleur/colors'

const isPrismaInstalledGlobally = isCurrentBinInstalledGlobally()

export function printUpdateMessage(checkResult: { status: 'ok'; data: Check.Response }): void {
  let boxHeight = 4
  let majorText = ''

  const currentVersionInstalled = checkResult.data.previous_version
  const latestVersionAvailable = checkResult.data.current_version

  const prismaCLICommand = makeInstallCommand(checkResult.data.package, checkResult.data.release_tag)
  const prismaClientCommand = makeInstallCommand('@prisma/client', checkResult.data.release_tag, {
    canBeGlobal: false,
    canBeDev: false,
  })

  try {
    const [majorInstalled] = currentVersionInstalled.split('.')
    const [majorLatest] = latestVersionAvailable.split('.')

    if (majorInstalled < majorLatest) {
      majorText = `\nThis is a major update - please follow the guide at\nhttps://pris.ly/d/major-version-upgrade\n\n`
      boxHeight = boxHeight + 4
    }
  } catch (e) {}

  const boxText = `\n${blue(
    'Update available',
  )} ${currentVersionInstalled} -> ${latestVersionAvailable}\n${majorText}Run the following to update
  ${bold(prismaCLICommand)}
  ${bold(prismaClientCommand)}`

  const boxedMessage = drawBox({
    height: boxHeight,
    width: 59,
    str: boxText,
    horizontalPadding: 2,
  })

  console.error(boxedMessage)
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
  // see https://www.npmjs.com/package/prisma?activeTab=versions
  // (can only be latest or dev via checkpoint-server)
  command += `@${tag}`

  return command
}
