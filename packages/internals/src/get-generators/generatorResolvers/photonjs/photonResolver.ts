import { bold, green, red } from 'kleur/colors'

import { GeneratorPaths } from '../generatorResolvers'
import { getPackageCmd } from '../prisma-client-js/auto-installation/getPackageCmd'

/**
 * Old Photon generator resolver. Since Photon has been renamed to Prisma
 * Client, this resolver will simply throw an error about that.
 * @param baseDir
 */
export async function photonResolver(baseDir: string): Promise<GeneratorPaths> {
  throw new Error(`Oops! Photon has been renamed to Prisma Client. Please make the following adjustments:
1. Rename ${red('provider = "photonjs"')} to ${green('provider = "prisma-client-js"')} in your ${bold(
    'schema.prisma',
  )} file.
2. Replace your ${bold('package.json')}'s ${red('@prisma/photon')} dependency to ${green('@prisma/client')}
3. Replace ${red("import { Photon } from '@prisma/photon'")} with ${green(
    "import { PrismaClient } from '@prisma/client'",
  )} in your code.
4. Run ${green(await getPackageCmd(baseDir, 'execute', 'prisma generate'))} again.
    `)
}
