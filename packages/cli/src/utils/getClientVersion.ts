import fs from 'fs'
import Module from 'module'
import path from 'path'
import pkgUp from 'pkg-up'
import { pathToFileURL } from 'url'
import { promisify } from 'util'

const readFileAsync = promisify(fs.readFile)

/**
 * Try reading the installed Prisma Client version
 */
export async function getInstalledPrismaClientVersion(cwd: string = process.cwd()): Promise<string | null> {
  return (await getPrismaClientVersionFromNodeModules(cwd)) ?? (await getPrismaClientVersionFromLocalPackageJson(cwd))
}

/**
 * Try reading the version from the generated client.
 * @param cwd The current working directory.
 * @param clientPath The path to the generated client root.
 * @returns The version of the generated client or null if it couldn't be found.
 */
export async function getGeneratedClientVersion(
  cwd: string,
  clientPath: string = path.join('node_modules', '.prisma', 'client'),
): Promise<string | null> {
  try {
    const generatedClientPath = path.resolve(cwd, clientPath, 'index.js')
    const generatedClientImport = await import(pathToFileURL(generatedClientPath).toString())

    return generatedClientImport.Prisma.prismaVersion.client
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

    const pkgJsonString = await readFileAsync(pkgJsonPath, 'utf-8')
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
    const pkgJsonPath = await pkgUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await readFileAsync(pkgJsonPath, 'utf-8')
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
