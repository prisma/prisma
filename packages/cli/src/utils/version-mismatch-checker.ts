import fs from 'fs'
import { bold, yellow } from 'kleur/colors'
import { packageUp } from 'package-up'

/**
 * Result of version mismatch check
 */
export interface VersionMismatchResult {
  hasMismatch: boolean
  globalVersion: string
  localPackageType: '@prisma/client' | 'prisma'
  localVersion: string
}

/**
 * Options for version mismatch check - using dependency injection for testability
 */
export interface VersionMismatchOptions {
  /** Function to check if prisma is installed globally */
  isGlobalInstall: () => string | false
  /** Function to get installed @prisma/client version */
  getClientVersion: (cwd: string) => Promise<string | null>
  /** Function to get local prisma version from package.json */
  getLocalPrismaVersion: (cwd: string) => Promise<string | null>
  /** Current working directory */
  cwd?: string
}

/**
 * Extract exact version from npm version specifier
 * Handles: ^1.2.3, ~1.2.3, 1.2.3, >=1.2.3, workspace:*, etc.
 */
function extractExactVersion(version: unknown): string | null {
  if (typeof version !== 'string') return null
  const match = version.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)
  return match?.[0] ?? null
}

/**
 * Get the local prisma version from package.json dependencies/devDependencies
 */
export async function getLocalPrismaVersion(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = await packageUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString)
    const prismaVersionSpecifier = pkgJson.dependencies?.['prisma'] ?? pkgJson.devDependencies?.['prisma']

    if (!prismaVersionSpecifier) {
      return null
    }

    // Extract exact version from specifier (e.g., "^5.0.0" -> "5.0.0")
    return extractExactVersion(prismaVersionSpecifier)
  } catch {
    return null
  }
}

/**
 * Check for version mismatch between global prisma and local packages
 * Returns null if no mismatch, or VersionMismatchResult if there is a mismatch
 */
export async function checkVersionMismatch(
  globalVersion: string,
  options: VersionMismatchOptions,
): Promise<VersionMismatchResult | null> {
  const { isGlobalInstall, getClientVersion, getLocalPrismaVersion, cwd = process.cwd() } = options

  // Only check if prisma is installed globally
  const globalInstallType = isGlobalInstall()
  if (!globalInstallType) {
    return null
  }

  try {
    // Normalize global version (extract exact version from specifier)
    const normalizedGlobalVersion = extractExactVersion(globalVersion) ?? globalVersion
    
    const localClientVersionRaw = await getClientVersion(cwd)
    const localClientVersion = extractExactVersion(localClientVersionRaw) ?? localClientVersionRaw
    
    const localPrismaVersion = await getLocalPrismaVersion(cwd)

    // Check @prisma/client version mismatch
    if (localClientVersion && localClientVersion !== normalizedGlobalVersion) {
      return {
        hasMismatch: true,
        globalVersion,
        localPackageType: '@prisma/client',
        localVersion: localClientVersion,
      }
    }

    // Check local prisma version mismatch
    if (localPrismaVersion && localPrismaVersion !== normalizedGlobalVersion) {
      return {
        hasMismatch: true,
        globalVersion,
        localPackageType: 'prisma',
        localVersion: localPrismaVersion,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Format the version mismatch warning message
 */
export function formatVersionMismatchWarning(result: VersionMismatchResult): string {
  return `${yellow(bold('warn'))} Global ${bold(`prisma@${result.globalVersion}`)} and Local ${bold(
    `${result.localPackageType}@${result.localVersion}`,
  )} don't match. This might lead to unexpected behavior. Please make sure they have the same version.`
}
