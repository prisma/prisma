import execa from 'execa'
import fs from 'fs'
import { bold, green } from 'kleur/colors'
import path from 'path'
import type { NormalizedPackageJson } from 'read-pkg-up'
import readPkgUp from 'read-pkg-up'
import { promisify } from 'util'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

/**
 * Async
 */

export async function getSchemaPath(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
): Promise<string | null> {
  return getSchemaPathInternal(schemaPathFromArgs, {
    cwd: opts.cwd,
  })
}

export async function getSchemaPathInternal(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
): Promise<string | null> {
  if (schemaPathFromArgs) {
    // 1. try the user custom path
    const customSchemaPath = await getAbsoluteSchemaPath(path.resolve(schemaPathFromArgs))
    if (!customSchemaPath) {
      throw new Error(`Provided --schema at ${schemaPathFromArgs} doesn't exist.`)
    }

    return customSchemaPath
  }

  // 2. Try the package.json `prisma.schema` custom path
  // 3. Try the conventional ./schema.prisma or ./prisma/schema.prisma paths
  // 4. Try resolving yarn workspaces and looking for a schema.prisma file there
  const schemaPath =
    (await getSchemaPathFromPackageJson(opts.cwd)) ??
    (await getRelativeSchemaPath(opts.cwd)) ??
    (await resolveYarnSchema(opts.cwd))

  if (schemaPath) {
    return schemaPath
  }

  return null
}

// Example:
// "prisma": {
//   "schema": "db/schema.prisma"
//   "seed": "ts-node db/seed.ts",
// }
export type PrismaConfig = {
  schema?: string
  seed?: string
}

export async function getPrismaConfigFromPackageJson(cwd: string) {
  const pkgJson = await readPkgUp({ cwd })
  const prismaPropertyFromPkgJson = pkgJson?.packageJson?.prisma as PrismaConfig | undefined

  if (!pkgJson) {
    return null
  }

  return {
    data: prismaPropertyFromPkgJson,
    packagePath: pkgJson.path,
  }
}

export async function getSchemaPathFromPackageJson(cwd: string): Promise<string | null> {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)

  if (!prismaConfig || !prismaConfig.data?.schema) {
    return null
  }

  const schemaPathFromPkgJson = prismaConfig.data.schema

  if (typeof schemaPathFromPkgJson !== 'string') {
    throw new Error(
      `Provided schema path \`${schemaPathFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` must be of type string`,
    )
  }

  const absoluteSchemaPath = path.isAbsolute(schemaPathFromPkgJson)
    ? schemaPathFromPkgJson
    : path.resolve(path.dirname(prismaConfig.packagePath), schemaPathFromPkgJson)

  if ((await exists(absoluteSchemaPath)) === false) {
    throw new Error(
      `Provided schema path \`${path.relative(cwd, absoluteSchemaPath)}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` doesn't exist.`,
    )
  }

  return absoluteSchemaPath
}

async function resolveYarnSchema(cwd: string): Promise<string | null> {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = await execa.command('yarn --version', {
        cwd,
      })

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = await execa.command('yarn workspaces info --json', {
        cwd,
      })
      const json = getJson(stdout)
      const workspaces = Object.values<{ location: string }>(json)
      const workspaceRootDir = await findWorkspaceRoot(cwd)

      if (!workspaceRootDir) {
        return null
      }

      // Iterate over the workspaces
      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceRootDir, workspace.location)
        const workspaceSchemaPath =
          getSchemaPathFromPackageJsonSync(workspacePath) ?? getRelativeSchemaPathSync(workspacePath)

        if (workspaceSchemaPath) {
          return workspaceSchemaPath
        }
      }

      const workspaceSchemaPathFromRoot =
        getSchemaPathFromPackageJsonSync(workspaceRootDir) ?? getRelativeSchemaPathSync(workspaceRootDir)

      if (workspaceSchemaPathFromRoot) {
        return workspaceSchemaPathFromRoot
      }
    } catch (e) {
      return null
    }
  }
  return null
}

function resolveYarnSchemaSync(cwd: string): string | null {
  if (process.env.npm_config_user_agent?.includes('yarn')) {
    try {
      const { stdout: version } = execa.commandSync('yarn --version', {
        cwd,
      })

      if (version.startsWith('2')) {
        return null
      }

      const { stdout } = execa.commandSync('yarn workspaces info --json', {
        cwd,
      })
      const json = getJson(stdout)
      const workspaces = Object.values<{ location: string }>(json)
      const workspaceRootDir = findWorkspaceRootSync(cwd)

      if (!workspaceRootDir) {
        return null
      }

      // Iterate over the workspaces
      for (const workspace of workspaces) {
        const workspacePath = path.join(workspaceRootDir, workspace.location)
        const workspaceSchemaPath =
          getSchemaPathFromPackageJsonSync(workspacePath) ?? getRelativeSchemaPathSync(workspacePath)

        if (workspaceSchemaPath) {
          return workspaceSchemaPath
        }
      }

      const workspaceSchemaPathFromRoot =
        getSchemaPathFromPackageJsonSync(workspaceRootDir) ?? getRelativeSchemaPathSync(workspaceRootDir)

      if (workspaceSchemaPathFromRoot) {
        return workspaceSchemaPathFromRoot
      }
    } catch (e) {
      return null
    }
  }
  return null
}

async function getAbsoluteSchemaPath(schemaPath: string): Promise<string | null> {
  if (await exists(schemaPath)) {
    return schemaPath
  }

  return null
}

export async function getRelativeSchemaPath(cwd: string): Promise<string | null> {
  let schemaPath: string | undefined

  schemaPath = path.join(cwd, 'schema.prisma')
  if (await exists(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(cwd, `prisma/schema.prisma`)
  if (await exists(schemaPath)) {
    return schemaPath
  }

  return null
}

/**
 * Small helper that returns the directory which contains the `schema.prisma` file
 */
export async function getSchemaDir(schemaPathFromArgs?: string): Promise<string | null> {
  if (schemaPathFromArgs) {
    return path.resolve(path.dirname(schemaPathFromArgs))
  }

  const schemaPath = await getSchemaPath(schemaPathFromArgs)

  if (!schemaPath) {
    return null
  }

  return path.dirname(schemaPath)
}

export async function getSchema(schemaPathFromArgs?: string): Promise<string> {
  const schemaPath = await getSchemaPath(schemaPathFromArgs)

  if (!schemaPath) {
    throw new Error(
      `Could not find a ${bold(
        'schema.prisma',
      )} file that is required for this command.\nYou can either provide it with ${green(
        '--schema',
      )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${green(
        './prisma/schema.prisma',
      )} https://pris.ly/d/prisma-schema-location`,
    )
  }

  return readFile(schemaPath, 'utf-8')
}

/**
 * Sync
 */

export function getSchemaPathSync(schemaPathFromArgs?: string): string | null {
  return getSchemaPathSyncInternal(schemaPathFromArgs, {
    cwd: process.cwd(),
  })
}

export function getSchemaPathSyncInternal(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
): string | null {
  if (schemaPathFromArgs) {
    // 1. Try the user custom path
    const customSchemaPath = getAbsoluteSchemaPathSync(path.resolve(schemaPathFromArgs))
    if (!customSchemaPath) {
      throw new Error(`Provided --schema at ${schemaPathFromArgs} doesn't exist.`)
    }

    return customSchemaPath
  }

  // 2. Try the package.json `prisma.schema` custom path
  // 3. Try the conventional `./schema.prisma` or `./prisma/schema.prisma` paths
  // 4. Try resolving yarn workspaces and looking for a schema.prisma file there
  const schemaPath =
    getSchemaPathFromPackageJsonSync(opts.cwd) ?? getRelativeSchemaPathSync(opts.cwd) ?? resolveYarnSchemaSync(opts.cwd)

  if (schemaPath) {
    return schemaPath
  }

  return null
}

export function getSchemaPathFromPackageJsonSync(cwd: string): string | null {
  const pkgJson = readPkgUp.sync({ cwd })
  const schemaPathFromPkgJson: string | undefined = pkgJson?.packageJson?.prisma?.schema

  if (!schemaPathFromPkgJson || !pkgJson) {
    return null
  }

  if (typeof schemaPathFromPkgJson !== 'string') {
    throw new Error(
      `Provided schema path \`${schemaPathFromPkgJson}\` from \`${path.relative(
        cwd,
        pkgJson.path,
      )}\` must be of type string`,
    )
  }

  const absoluteSchemaPath = path.isAbsolute(schemaPathFromPkgJson)
    ? schemaPathFromPkgJson
    : path.resolve(path.dirname(pkgJson.path), schemaPathFromPkgJson)

  if (fs.existsSync(absoluteSchemaPath) === false) {
    throw new Error(
      `Provided schema path \`${path.relative(cwd, absoluteSchemaPath)}\` from \`${path.relative(
        cwd,
        pkgJson.path,
      )}\` doesn't exist.`,
    )
  }

  return absoluteSchemaPath
}

function getAbsoluteSchemaPathSync(schemaPath: string): string | null {
  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  return null
}

function getRelativeSchemaPathSync(cwd: string): string | null {
  let schemaPath = path.join(cwd, 'schema.prisma')

  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  schemaPath = path.join(cwd, `prisma/schema.prisma`)

  if (fs.existsSync(schemaPath)) {
    return schemaPath
  }

  return null
}

function getJson(stdout: string): any {
  const firstCurly = stdout.indexOf('{')
  const lastCurly = stdout.lastIndexOf('}')
  const sliced = stdout.slice(firstCurly, lastCurly + 1)
  return JSON.parse(sliced)
}

function isPkgJsonWorkspaceRoot(pkgJson: NormalizedPackageJson) {
  const workspaces = pkgJson.workspaces

  if (!workspaces) {
    return false
  }

  return Array.isArray(workspaces) || workspaces.packages !== undefined
}

async function isNearestPkgJsonWorkspaceRoot(cwd: string) {
  const pkgJson = await readPkgUp({ cwd })

  if (!pkgJson) {
    return null
  }

  return {
    isRoot: isPkgJsonWorkspaceRoot(pkgJson.packageJson),
    path: pkgJson.path,
  }
}

function isNearestPkgJsonWorkspaceRootSync(cwd: string) {
  const pkgJson = readPkgUp.sync({ cwd })

  if (!pkgJson) {
    return null
  }

  return {
    isRoot: isPkgJsonWorkspaceRoot(pkgJson.packageJson),
    path: pkgJson.path,
  }
}

async function findWorkspaceRoot(cwd: string): Promise<string | null> {
  let pkgJson = await isNearestPkgJsonWorkspaceRoot(cwd)

  if (!pkgJson) {
    return null
  }

  if (pkgJson.isRoot === true) {
    return path.dirname(pkgJson.path)
  }

  const pkgJsonParentDir = path.dirname(path.dirname(pkgJson.path))

  pkgJson = await isNearestPkgJsonWorkspaceRoot(pkgJsonParentDir)

  if (!pkgJson || pkgJson.isRoot === false) {
    return null
  }

  return path.dirname(pkgJson.path)
}

function findWorkspaceRootSync(cwd: string): string | null {
  let pkgJson = isNearestPkgJsonWorkspaceRootSync(cwd)

  if (!pkgJson) {
    return null
  }

  if (pkgJson.isRoot === true) {
    return path.dirname(pkgJson.path)
  }

  const pkgJsonParentDir = path.dirname(path.dirname(pkgJson.path))

  pkgJson = isNearestPkgJsonWorkspaceRootSync(pkgJsonParentDir)

  if (!pkgJson || pkgJson.isRoot === false) {
    return null
  }

  return path.dirname(pkgJson.path)
}
