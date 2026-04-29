import fs from 'node:fs'
import path from 'node:path'

import { isCurrentBinInstalledGlobally } from '@prisma/internals'
import { bold, yellow } from 'kleur/colors'

/**
 * Checks whether a local `prisma` package is installed in the project's `node_modules`.
 * Returns the resolved path if found, or `undefined` otherwise.
 */
export function findLocalPrismaInstallation(cwd: string = process.cwd()): string | undefined {
  // On Windows, npm/yarn/pnpm expose local bins as `prisma.cmd` (and sometimes `prisma.ps1`);
  // on POSIX systems the shim is just `prisma`. Check all common variants so a valid local
  // installation is not missed based on platform.
  const localBinCandidates = [
    path.join(cwd, 'node_modules', '.bin', 'prisma'),
    path.join(cwd, 'node_modules', '.bin', 'prisma.cmd'),
  ]
  for (const candidate of localBinCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  const localPackagePath = path.join(cwd, 'node_modules', 'prisma')
  if (fs.existsSync(localPackagePath)) {
    return localPackagePath
  }

  return undefined
}

/**
 * When the current binary is installed globally and a local installation exists in the
 * project's `node_modules`, prints a warning to stderr advising the user to use `npx prisma`
 * instead.
 *
 * See: https://github.com/prisma/prisma/issues/2738
 */
export function warnIfLocalInstallationShadowed(): void {
  const globalManager = isCurrentBinInstalledGlobally()
  if (!globalManager) {
    return
  }

  const localPath = findLocalPrismaInstallation()
  if (!localPath) {
    return
  }

  const message = `${yellow(bold('warn'))} You are using the global Prisma CLI (installed via ${globalManager}), but a local installation was found in this project.
To avoid version mismatches, use the local CLI instead:
  ${bold('npx prisma <command>')}`

  console.warn(message)
}
