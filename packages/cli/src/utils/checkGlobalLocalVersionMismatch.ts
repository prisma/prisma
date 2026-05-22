import { isCurrentBinInstalledGlobally } from '@prisma/internals'
import fs from 'fs'
import { bold, yellow } from 'kleur/colors'
import Module from 'module'

import { getInstalledPrismaClientVersion } from './getClientVersion'

type PackageName = 'prisma' | '@prisma/client'

export type GlobalLocalVersionMismatch = {
  packageName: PackageName
  globalVersion: string
  localVersion: string
}

export type CheckGlobalLocalVersionMismatchOptions = {
  cwd?: string
  globalVersion: string
  isGlobalInstall?: () => 'npm' | false
  getLocalPrismaCliVersion?: (cwd: string) => Promise<string | null>
  getLocalPrismaClientVersion?: (cwd: string) => Promise<string | null>
}

/**
 * Detect if the currently running global Prisma CLI differs from the
 * `prisma` / `@prisma/client` versions installed in the local project, and
 * return a human-readable warning when it does. Returns null when not running
 * globally, when no local install can be found, or when versions match.
 *
 * Issue: https://github.com/prisma/prisma/issues/1911
 */
export async function getGlobalLocalVersionMismatchWarning(
  options: CheckGlobalLocalVersionMismatchOptions,
): Promise<string | null> {
  const isGlobalInstall = options.isGlobalInstall ?? isCurrentBinInstalledGlobally
  if (!isGlobalInstall()) {
    return null
  }

  const cwd = options.cwd ?? process.cwd()
  const getLocalPrismaCliVersion = options.getLocalPrismaCliVersion ?? getInstalledPrismaCliVersion
  const getLocalPrismaClientVersion = options.getLocalPrismaClientVersion ?? getInstalledPrismaClientVersion

  const [localPrismaVersion, localClientVersion] = await Promise.all([
    getLocalPrismaCliVersion(cwd),
    getLocalPrismaClientVersion(cwd),
  ])

  const mismatches: GlobalLocalVersionMismatch[] = []
  if (localPrismaVersion && localPrismaVersion !== options.globalVersion) {
    mismatches.push({ packageName: 'prisma', globalVersion: options.globalVersion, localVersion: localPrismaVersion })
  }
  if (localClientVersion && localClientVersion !== options.globalVersion) {
    mismatches.push({
      packageName: '@prisma/client',
      globalVersion: options.globalVersion,
      localVersion: localClientVersion,
    })
  }

  if (mismatches.length === 0) {
    return null
  }

  return formatGlobalLocalVersionMismatchWarning(mismatches)
}

export function formatGlobalLocalVersionMismatchWarning(mismatches: GlobalLocalVersionMismatch[]): string {
  if (mismatches.length === 0) {
    return ''
  }
  const globalVersion = mismatches[0].globalVersion
  const localList = mismatches
    .map(({ packageName, localVersion }) => bold(`${packageName}@${localVersion}`))
    .join(' and ')

  return `${yellow(bold('warn'))} The globally installed ${bold(`prisma@${globalVersion}`)} does not match the local ${localList} installed in this project.
This may produce a client that is incompatible with the local runtime.
Re-run with the local CLI (e.g. \`npx prisma generate\`) or align the global and local versions.`
}

/**
 * Read the version field of the local `prisma` package from `node_modules`.
 * Resolved relative to `cwd` so the result reflects what is actually installed
 * in the project, not the specifier declared in `package.json`.
 */
export async function getInstalledPrismaCliVersion(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const resolvedPath = require.resolve('prisma/package.json', {
      paths: (Module as unknown as { _nodeModulePaths(from: string): string[] })._nodeModulePaths(cwd),
    })
    const pkgJsonString = await fs.promises.readFile(resolvedPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString) as { version?: string }
    return pkgJson.version ?? null
  } catch {
    return null
  }
}
