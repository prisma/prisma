import chalk from 'chalk'

import { GeneratorPaths } from '../generatorResolvers'
import { getPackageCmd } from '../prisma-client-js/auto-installation/getPackageCmd'

export function photonResolver(baseDir: string): Promise<GeneratorPaths> {
  throw new Error(`Oops! Photon has been renamed to Prisma Client. Please make the following adjustments:
1. Rename ${chalk.red('provider = "photonjs"')} to ${chalk.green('provider = "prisma-client-js"')} in your ${chalk.bold(
    'schema.prisma',
  )} file.
2. Replace your ${chalk.bold('package.json')}'s ${chalk.red('@prisma/photon')} dependency to ${chalk.green(
    '@prisma/client',
  )}
3. Replace ${chalk.red("import { Photon } from '@prisma/photon'")} with ${chalk.green(
    "import { PrismaClient } from '@prisma/client'",
  )} in your code.
4. Run ${chalk.green(getPackageCmd(baseDir, 'execute', 'prisma generate'))} again.
    `)
}
