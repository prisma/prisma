import {
  isOfficialDriverAdapter,
  type OfficialDriverAdapters,
  type OfficialUnderlyingDrivers,
  underlyingDriverAdaptersMap,
} from '@prisma/driver-adapter-utils'
import fs from 'fs'
import Module from 'module'
import pkgUp from 'pkg-up'

/**
 * Try reading the installed Prisma Client version
 */
export async function getInstalledPrismaClientVersion(cwd: string = process.cwd()): Promise<string | null> {
  return (await getPrismaClientVersionFromNodeModules(cwd)) ?? (await getPrismaClientVersionFromLocalPackageJson(cwd))
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

type DriverAdapterVersion = {
  name: OfficialDriverAdapters
  version: string
  underlyingDriver: {
    name: OfficialUnderlyingDrivers
    version: string | null
  }
}

/**
 * Try reading the Prisma Driver Adapter versions from the local package.json.
 * This also includes the underlying driver versions, if found. They are looked up
 * among the `dependencies` only, with the exception of `wrangler` for `@prisma/adapter-d1`,
 * which can also be a `devDependency`.
 * Only official, well-known Driver Adapters are considered.
 */
export async function getPrismaDriverAdapterVersionsFromLocalPackageJson(
  cwd: string = process.cwd(),
): Promise<Array<DriverAdapterVersion> | null> {
  try {
    const pkgJsonPath = await pkgUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    const adapterVersions = Object.entries((pkgJson.dependencies ?? {}) as Record<string, string>)
      // Find all known Driver Adapter dependencies, usually `@prisma/adapter-*`:
      .filter(([key]) => isOfficialDriverAdapter(key)) as Array<[OfficialDriverAdapters, string]>

    const adapterVersionsWithUnderlyingDrivers = adapterVersions.map(([adapterName, adapterVersion]) => {
      const underlyingDriver = underlyingDriverAdaptersMap[adapterName]
      let underlyingDriverVersion = pkgJson.dependencies?.[underlyingDriver] ?? null

      // `wrangler` is the only underlying driver that can be just a `devDependency`.
      if (underlyingDriverVersion === null && underlyingDriver === 'wrangler') {
        underlyingDriverVersion = pkgJson.devDependencies?.[underlyingDriver] ?? null
      }

      return {
        name: adapterName,
        version: adapterVersion,
        underlyingDriver: {
          name: underlyingDriver,
          version: underlyingDriverVersion,
        },
      }
    })

    return adapterVersionsWithUnderlyingDrivers
  } catch {
    return null
  }
}

/**
 * Try reading the Prisma Client version from the local package.json
 */
async function getPrismaClientVersionFromLocalPackageJson(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = await pkgUp({ cwd })

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
