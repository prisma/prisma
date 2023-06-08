import Debug from '@prisma/debug'
import fs from 'fs'
import { bold, dim } from 'kleur/colors'
import path from 'path'

import { logger } from '../../../..'
import { resolvePkg } from './resolve'
import { semverLt } from './semverLt'

const debug = Debug('prisma:generator')

// TODO: This is not well tested

/**
 * Warn, if typescript is below `4.1.0` and is installed locally because
 * template literal types are required for generating Prisma Client types.
 * https://www.prisma.io/docs/reference/system-requirements#software-requirements
 */
export async function checkTypeScriptVersion() {
  const minVersion = '4.1.0'
  try {
    const typescriptPath = await resolvePkg('typescript', {
      basedir: process.cwd(),
    })
    debug('typescriptPath', typescriptPath)
    const typescriptPkg = typescriptPath && path.join(typescriptPath, 'package.json')
    if (typescriptPkg && fs.existsSync(typescriptPkg)) {
      const pjson = require(typescriptPkg)
      const currentVersion = pjson.version
      if (semverLt(currentVersion, minVersion)) {
        logger.warn(
          `Prisma detected that your ${bold(
            'TypeScript',
          )} version ${currentVersion} is outdated. If you want to use Prisma Client with TypeScript please update it to version ${bold(
            minVersion,
          )} or ${bold('newer')}. ${dim(`TypeScript found in: ${bold(typescriptPath)}`)}`,
        )
      }
    }
  } catch (e) {
    // They do not have TS installed, we ignore (example: JS project)
  }
}
