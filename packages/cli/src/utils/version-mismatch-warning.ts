import { isCurrentBinInstalledGlobally } from '@prisma/internals'
import fs from 'fs'
import { bold, yellow } from 'kleur/colors'
import { packageUp } from 'package-up'
import path from 'path'

import { getInstalledPrismaClientVersion } from './getClientVersion'

export type PackageName = 'prisma' | '@prisma/client'

export type VersionMismatchWarningOptions = {
  cwd?: string
  globalVersion?: string
  isGlobalInstall?: () => 'npm' | false
  getPrismaClientVersion?: (cwd: string) => Promise<string | null>
  getPackageJsonVersion?: (cwd: string, packageName: PackageName) => Promise<string | null>
  detectPackageManager?: (cwd: string) => PackageManager
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type VersionMismatch = {
  packageName: PackageName
  globalVersion: string
  localVersion: string
}

export async function getVersionMismatchWarning(options: VersionMismatchWarningOptions = {}): Promise<string | null> {
  const isGlobalInstall = options.isGlobalInstall ?? isCurrentBinInstalledGlobally

  if (!isGlobalInstall()) {
    return null
  }

  const cwd = options.cwd ?? process.cwd()
  const globalVersion = normalizeVersion(options.globalVersion)

  if (!globalVersion) {
    return null
  }

  const getClientVersion = options.getPrismaClientVersion ?? getInstalledPrismaClientVersion
  const getPackageVersion = options.getPackageJsonVersion ?? getPackageJsonVersion
  const detectPackageManager = options.detectPackageManager ?? detectPackageManagerFromProject

  const localClientVersion = normalizeVersion(await getClientVersion(cwd))
  const localPrismaVersion = normalizeVersion(await getPackageVersion(cwd, 'prisma'))
  const packageManager = detectPackageManager(cwd)

  const mismatches = [
    findMismatch('prisma', globalVersion, localPrismaVersion),
    findMismatch('@prisma/client', globalVersion, localClientVersion),
  ].filter((mismatch): mismatch is VersionMismatch => Boolean(mismatch))

  if (mismatches.length === 0) {
    return null
  }

  return formatVersionMismatchWarning(mismatches, packageManager)
}

export function formatVersionMismatchWarning(
  mismatch: VersionMismatch | VersionMismatch[],
  packageManager: PackageManager = 'npm',
): string {
  const mismatches = Array.isArray(mismatch) ? mismatch : [mismatch]
  const globalVersion = mismatches[0]?.globalVersion
  const localVersions = mismatches
    .map(({ packageName, localVersion }) => bold(`${packageName}@${localVersion}`))
    .join(' and ')

  return `${yellow(bold('warn'))} The globally installed ${bold(`prisma@${globalVersion}`)} does not match the local ${localVersions}.
This can lead to unexpected behavior when running ${bold('prisma generate')}.
Install matching versions locally and run ${bold(getPrismaGenerateCommand(packageManager))} to use the project version.`
}

function findMismatch(
  packageName: PackageName,
  globalVersion: string,
  localVersion: string | null,
): VersionMismatch | null {
  if (!localVersion || localVersion === globalVersion) {
    return null
  }

  return {
    packageName,
    globalVersion,
    localVersion,
  }
}

export async function getPackageJsonVersion(cwd: string, packageName: PackageName): Promise<string | null> {
  try {
    const packageJsonPath = await packageUp({ cwd })

    if (!packageJsonPath) {
      return null
    }

    const packageJsonString = await fs.promises.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonString)

    return (
      packageJson.dependencies?.[packageName] ??
      packageJson.devDependencies?.[packageName] ??
      packageJson.peerDependencies?.[packageName] ??
      null
    )
  } catch {
    return null
  }
}

export function normalizeVersion(version: string | null | undefined): string | null {
  if (!version) {
    return null
  }

  const trimmed = version.trim()

  if (trimmed.startsWith('workspace:') || /^[a-z]+$/i.test(trimmed)) {
    return null
  }

  const match = trimmed.match(/^[~^]?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)

  return match?.[1] ?? null
}

function detectPackageManagerFromProject(cwd: string): PackageManager {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(cwd, 'bun.lock')) || fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun'

  const packageJsonPath = path.join(cwd, 'package.json')
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const packageManager = packageJson.packageManager as string | undefined

    if (packageManager?.startsWith('pnpm')) return 'pnpm'
    if (packageManager?.startsWith('yarn')) return 'yarn'
    if (packageManager?.startsWith('bun')) return 'bun'
  } catch {
    // Fall back to npm when the project package manager cannot be determined.
  }

  return 'npm'
}

function getPrismaGenerateCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm prisma generate'
    case 'yarn':
      return 'yarn prisma generate'
    case 'bun':
      return 'bun prisma generate'
    case 'npm':
      return 'npx prisma generate'
  }
}
