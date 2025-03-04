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
      majorText = '\nThis is a major update - please follow the guide at\nhttps://pris.ly/d/major-version-upgrade\n\n'
      boxHeight = boxHeight + 4
    }
  } catch (_e) {}

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
  let command = ''
  if (isPrismaInstalledGlobally === 'npm' && options.canBeGlobal) {
    command = `npm i -g ${packageName}`
  } else if (options.canBeDev) {
    command = `npm i --save-dev ${packageName}`
  } else {
    command = `npm i ${packageName}`
  }

  // always output tag (so major upgrades work)
  // see https://www.npmjs.com/package/prisma?activeTab=versions
  // (can only be latest or dev via checkpoint-server)
  command += `@${tag}`

  return command
}
