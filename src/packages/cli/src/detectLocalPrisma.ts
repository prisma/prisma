import fs from 'fs'
import path from 'path'
import { isCurrentBinInstalledGlobally } from '@prisma/sdk'
import { printWarning } from './prompt/utils/print'

const isPrismaInstalledGlobally = isCurrentBinInstalledGlobally()

export function detectLocalPrisma() {
  // TODO: Alternatively we can prompt the user before executing the
  // command with the global installation.
  // See: https://github.com/prisma/prisma/issues/2738
  if (
    true ||
    (isPrismaInstalledGlobally &&
      fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', 'prisma')))
  ) {
    console.warn(
      printWarning(`You're running a global installation of Prisma but we detected a local
          installation in your node modules. It's recommended to always run a
          locally available installation of Prisma.`),
    )
  }
}
