import fs from 'fs'
import Module from 'module'
import { packageUp } from 'package-up'

/**
 * Try reading the installed Prisma Client version
 */
export async function getInstalledPrismaClientVersion(cwd: string = process.cwd()): Promise<string | null> {
  return (await getPrismaClientVersionFromNodeModules(cwd)) ?? (await getPrismaClientVersionFromLocalPackageJson(cwd))
}

/**
 * Read the version field of the local `prisma` package from `node_modules`.
 * Resolved relative to `cwd` so the result reflects what is actually installed
 * in the project, not the specifier declared in `package.json`.
 */
export async function getInstalledPrismaCliVersion(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = requireResolveFrom('prisma/package.json', cwd)

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString) as { version?: string }

    return pkgJson.version ?? null
  } catch {
    return null
  }
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
