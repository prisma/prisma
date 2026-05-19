import fs from 'node:fs/promises'

import { yellow } from 'kleur/colors'
import { packageUp } from 'package-up'
import semver from 'semver'

import packageJson from '../../package.json'

type LocalPrismaVersions = {
  prisma: string | null
  prismaClient: string | null
}

/**
 * Checks if the global Prisma CLI version differs from the local project's
 * Prisma or @prisma/client versions, and logs a warning if they don't match.
 *
 * @param cwd - The current working directory to search for local package.json
 * @returns Promise that resolves when the check is complete
 */
export async function checkVersionMismatch(cwd: string = process.cwd()): Promise<void> {
  const globalVersion = normalizeVersion(packageJson.version)

  if (!globalVersion) {
    return
  }

  const localVersions = await getLocalPrismaVersions(cwd)
  const localVersion = getMismatchedLocalVersion(globalVersion, localVersions)

  if (!localVersion) {
    return
  }

  console.warn(
    yellow(
      `prisma warn Your global prisma version (${globalVersion}) differs from local version (${localVersion}). Run npm install prisma@${globalVersion} to align.`,
    ),
  )
}

/**
 * Reads the local package.json and extracts Prisma and @prisma/client versions.
 *
 * @param cwd - The directory to search for package.json
 * @returns Object containing prisma and prismaClient versions, or null if not found
 */
async function getLocalPrismaVersions(cwd: string): Promise<LocalPrismaVersions> {
  try {
    const packageJsonPath = await packageUp({ cwd })

    if (!packageJsonPath) {
      return { prisma: null, prismaClient: null }
    }

    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8')
    const localPackageJson = JSON.parse(packageJsonContent)

    return {
      prisma: normalizeVersion(readPackageVersion(localPackageJson, 'prisma')),
      prismaClient: normalizeVersion(readPackageVersion(localPackageJson, '@prisma/client')),
    }
  } catch {
    // Silently fail if we cannot read or parse local package.json
    // This is intentional - the version check is a nice-to-have, not a requirement
    return { prisma: null, prismaClient: null }
  }
}

/**
 * Reads a dependency version from package.json dependencies or devDependencies.
 *
 * @param packageJsonValue - The parsed package.json object
 * @param dependencyName - The dependency to look for ('prisma' or '@prisma/client')
 * @returns The version string if found, null otherwise
 */
function readPackageVersion(
  packageJsonValue: Record<string, unknown>,
  dependencyName: 'prisma' | '@prisma/client',
): string | null {
  const packageGroups = ['dependencies', 'devDependencies'] as const

  for (const groupName of packageGroups) {
    const group = packageJsonValue[groupName]

    if (!group || typeof group !== 'object') {
      continue
    }

    const version = (group as Record<string, unknown>)[dependencyName]

    if (typeof version === 'string') {
      return version
    }
  }

  return null
}

/**
 * Determines if there's a version mismatch between global and local versions.
 * Returns the local version that differs, or null if they match.
 *
 * @param globalVersion - The global CLI version
 * @param localVersions - The local project versions
 * @returns The mismatched local version string, or null if no mismatch
 */
function getMismatchedLocalVersion(globalVersion: string, localVersions: LocalPrismaVersions): string | null {
  if (localVersions.prisma && !semver.eq(globalVersion, localVersions.prisma)) {
    return localVersions.prisma
  }

  if (localVersions.prismaClient && !semver.eq(globalVersion, localVersions.prismaClient)) {
    return localVersions.prismaClient
  }

  return null
}

/**
 * Normalizes a version string using semver to handle ranges and aliases.
 *
 * @param version - The version string to normalize (e.g., '^5.0.0', '~5.1.0', '5.2.0')
 * @returns The normalized semver version string, or null if invalid
 */
function normalizeVersion(version: string | null): string | null {
  if (!version) {
    return null
  }

  return semver.minVersion(version)?.version ?? null
}
