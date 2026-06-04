import fs from 'fs'
import Module from 'module'
import { packageUp } from 'package-up'
import path from 'path'

/**
 * Try reading the installed Prisma Client version
 */
export async function getInstalledPrismaClientVersion(cwd: string = process.cwd()): Promise<string | null> {
  return (await getPrismaClientVersionFromNodeModules(cwd)) ?? (await getPrismaClientVersionFromLocalPackageJson(cwd))
}

/**
 * Try reading the locally installed prisma CLI version by walking up from `cwd` looking
 * for `node_modules/prisma/package.json`. Returns null when prisma is not installed locally.
 *
 * Uses explicit filesystem traversal rather than `require.resolve` because the prisma CLI
 * is itself the `prisma` package — Node's resolver would otherwise find the CLI's own
 * package.json instead of a locally installed one.
 *
 * Unlike `getInstalledPrismaClientVersion`, this does NOT fall back to the project's
 * declared dependency specifier — only a real, installed version under node_modules is
 * comparable to the globally running CLI version.
 */
export async function getInstalledPrismaCliVersion(cwd: string = process.cwd()): Promise<string | null> {
  try {
    let dir = path.resolve(cwd)
    // walk up to filesystem root
    while (true) {
      const candidate = path.join(dir, 'node_modules', 'prisma', 'package.json')
      try {
        const pkgJson = JSON.parse(await fs.promises.readFile(candidate, 'utf-8'))
        // Guard the type: a malformed package.json could carry a non-string
        // `version` (e.g. a number), which must not leak through the
        // `Promise<string | null>` contract.
        return typeof pkgJson.version === 'string' ? pkgJson.version : null
      } catch (error: unknown) {
        // Only ENOENT means "not here, keep walking". Any other error
        // (EACCES, parse failure, etc.) on an existing candidate is terminal
        // — silently continuing could resolve a different prisma higher up
        // and produce a misleading warning.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          return null
        }
      }
      const parent = path.dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  } catch {
    return null
  }
}

const exactSemverRegex = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/

/**
 * Decide whether to surface a "global prisma vs locally-installed prisma" mismatch warning.
 *
 * Both inputs are concrete, installed versions: `globalCliVersion` is the running CLI's
 * own `pkg.version` and `installedLocalPrismaCliVersion` is read from an installed
 * `node_modules/prisma/package.json` (see `getInstalledPrismaCliVersion`). Neither is ever
 * a dependency specifier. The exact-semver guard is therefore defensive — it only acts when
 * both strings are concrete versions, so a malformed/non-version `version` field can never
 * produce a misleading warning. Comparison is exact-string by design (an advisory about
 * differing installed identities), so prerelease/build-metadata differences do surface.
 */
export function shouldWarnGlobalLocalCliMismatch(args: {
  isGlobalInstall: boolean
  globalCliVersion: string | null | undefined
  installedLocalPrismaCliVersion: string | null | undefined
}): boolean {
  const { isGlobalInstall, globalCliVersion, installedLocalPrismaCliVersion } = args
  if (!isGlobalInstall) return false
  if (!globalCliVersion || !installedLocalPrismaCliVersion) return false
  if (!exactSemverRegex.test(globalCliVersion)) return false
  if (!exactSemverRegex.test(installedLocalPrismaCliVersion)) return false
  return globalCliVersion !== installedLocalPrismaCliVersion
}

/**
 * Try reading the Prisma Client version from its package.json
 */
async function getPrismaClientVersionFromNodeModules(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = requireResolveFrom('@prisma/client/package.json', cwd)

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString)

    if (!pkgJson.version) {
      return null
    }

    return pkgJson.version
  } catch {
    return null
  }
}

/**
 * Try reading the Prisma Client version from the local package.json
 */
async function getPrismaClientVersionFromLocalPackageJson(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = await packageUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString)
    const clientVersion = pkgJson.dependencies?.['@prisma/client'] ?? pkgJson.devDependencies?.['@prisma/client']

    if (!clientVersion) {
      return null
    }

    return clientVersion
  } catch {
    return null
  }
}

/**
 * Run require resolve from a given path
 */
function requireResolveFrom(moduleId: string, fromDir: string): string | null {
  try {
    const resolvedPath = require.resolve(moduleId, {
      paths: (Module as any)._nodeModulePaths(fromDir),
    })

    return resolvedPath
  } catch {
    return null
  }
}
