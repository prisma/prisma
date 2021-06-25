import { logger, semverLt } from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import resolvePkg from 'resolve-pkg'
/**
 * Warn, if typescript is below `4.1.0` and is install locally
 * Because Template Literal Types are required for generating Prisma Client types.
 */
export function checkTypeScriptVersion() {
  const minVersion = '4.1.0'
  try {
    const typescriptPath = resolvePkg('typescript', { cwd: process.cwd() })
    const typescriptPkg =
      typescriptPath && path.join(typescriptPath, 'package.json')
    if (typescriptPkg && fs.existsSync(typescriptPkg)) {
      const pjson = require(typescriptPkg)
      const currentVersion = pjson.version
      if (semverLt(currentVersion, minVersion)) {
        logger.warn(
          `Your ${chalk.bold(
            'typescript',
          )} version is ${currentVersion}, which is outdated. Please update it to ${chalk.bold(
            minVersion,
          )} or ${chalk.bold('newer')} in order to use Prisma Client.`,
        )
      }
    }
  } catch (e) {
    // They do not have TS installed, we ignore (example: JS project)
  }
}
