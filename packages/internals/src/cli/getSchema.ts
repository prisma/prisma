import { Debug } from '@prisma/debug'
import { loadSchemaFiles, usesPrismaSchemaFolder } from '@prisma/schema-files-loader'
import execa from 'execa'
import fs from 'fs'
import { bold, green } from 'kleur/colors'
import path from 'path'
import { PackageJson, readPackageUp, readPackageUpSync } from 'read-package-up'
import { promisify } from 'util'

import { getConfig } from '../engine-commands'
import type { MultipleSchemas, MultipleSchemaTuple } from '../utils/schemaFileInput'

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const debug = Debug('prisma:getSchema')

export type GetSchemaResult = {
  /**
   * A path from which schema was loaded
   * Can be either folder or a single file
   */
  schemaPath: string
  /**
   * Base dir for all of the schema files.
   * In-multi file mode, this is equal to `schemaPath`.
   * In single-file mode, this is a parent directory of
   * a file
   */
  schemaRootDir: string
  /**
   * All loaded schema files
   */
  schemas: MultipleSchemas
}

/**
 * Async
 */

export async function getSchemaWithPath(): Promise<GetSchemaResult | null>
export async function getSchemaWithPath(schemaPathFromArgs: string, opts?: { cwd: string }): Promise<GetSchemaResult>
export async function getSchemaWithPath(
  schemaPathFromArgs?: string,
  opts?: { cwd: string },
): Promise<GetSchemaResult | null>
export async function getSchemaWithPath(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
) {
  return getSchemaWithPathInternal(schemaPathFromArgs, {
    cwd: opts.cwd,
  })
}

export async function readSchemaFromSingleFile(schemaPath: string): Promise<GetSchemaResult> {
  debug('Reading schema from single file', schemaPath)
  const file = await readFile(schemaPath, { encoding: 'utf-8' })
  const schemaTuple: MultipleSchemaTuple = [schemaPath, file]
  return { schemaPath, schemaRootDir: path.dirname(schemaPath), schemas: [schemaTuple] } as const
}

async function readSchemaFromMultiFiles(schemaPath: string): Promise<GetSchemaResult | null> {
  debug('Reading schema from multiple files', schemaPath)
  const files = await loadSchemaFiles(schemaPath)

  // TODO: problem: if the Prisma config isn't valid, we currently get a
  // `Error: Could not find a schema.prisma file that is required for this command.` error
  // in the multi-file case.
  debug('Loading config')
  const config = await getConfig({
    datamodel: files,
    ignoreEnvVarErrors: true,
  })
  debug('Ok')

  if (usesPrismaSchemaFolder(config)) {
    return { schemaPath, schemaRootDir: schemaPath, schemas: files } as const
  }

  return null
}

// This function only throws when `schemaPathFromArgs` is provided, yet the schema doesn't exist.
export async function getSchemaWithPathInternal(
  schemaPathFromArgs?: string,
  opts?: { cwd: string },
): Promise<GetSchemaResult | null>
export async function getSchemaWithPathInternal(
  schemaPathFromArgs: string,
  opts?: { cwd: string },
): Promise<GetSchemaResult>
export async function getSchemaWithPathInternal(
  schemaPathFromArgs?: string,
  opts: { cwd: string } = {
    cwd: process.cwd(),
  },
) {
  async function getSchemaResult(schemaPath: string) {
    // a. If it's a single file, read it and return it
    return (
      readSchemaFromSingleFile(schemaPath)
        // b. If it's a directory, load all files and return them, but only if the `prismaSchemaFolder` preview feature is used.
        .catch(() => readSchemaFromMultiFiles(schemaPath))
        // c. If it's neither, return null
        .catch(() => null)
    )
  }

  // 1. Try the user custom path, when provided.
  if (schemaPathFromArgs) {
    const customSchemaPath = await getAbsoluteSchemaPath(path.resolve(schemaPathFromArgs))
    const onError = () => {
      throw new Error(`Provided --schema at ${schemaPathFromArgs} doesn't exist.`)
    }

    if (!customSchemaPath) {
      return onError()
    }

    const customSchemaResult = await getSchemaResult(path.resolve(opts.cwd ?? process.cwd(), customSchemaPath))
    if (!customSchemaResult) {
      return onError()
    }

    return customSchemaResult
  }

  const trials = [
    // 2. Try the package.json `prisma.schema` custom path.
    { strategy: 'package.json', fn: getSchemaPathFromPackageJson, sourcePath: opts.cwd },
    // 3. Try the conventional ./schema.prisma or ./prisma/schema.prisma paths.
    { strategy: 'relative', fn: getRelativeSchemaPath, sourcePath: opts.cwd },
    // 4. Try resolving yarn workspaces and looking for a schema.prisma file there.
    { strategy: 'yarn', fn: resolveYarnSchema, sourcePath: opts.cwd },
  ] as const

  for (const { strategy, sourcePath, fn } of trials) {
    debug(`Trying ${strategy}...`)

    const schemaPath = await fn(sourcePath!)
    debug(`${strategy} resolved to ${schemaPath}`)

    if (!schemaPath) {
      continue
    }

    const schemaPathResult = await getSchemaResult(path.resolve(sourcePath, schemaPath))

    if (schemaPathResult) {
      return schemaPathResult
    }
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
  const pkgJson = await readPackageUp({ cwd, normalize: false })
  const prismaPropertyFromPkgJson = pkgJson?.packageJson?.prisma as PrismaConfig | undefined

  if (!pkgJson) {
    return null
  }

  return {
    data: prismaPropertyFromPkgJson,
    packagePath: pkgJson.path,
  }
}

async function getSchemaPathFromPackageJson(cwd: string): Promise<string | null> {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)
  debug('prismaConfig', prismaConfig)

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

async function getAbsoluteSchemaPath(schemaPath: string): Promise<string | null> {
  if (await exists(schemaPath)) {
    return schemaPath
  }

  return null
}

export async function getRelativeSchemaPath(cwd: string): Promise<string | null> {
  const relativeSchemaPaths = [
    'schema.prisma',
    path.join('prisma', 'schema.prisma'),
    path.join('prisma', 'schema'),
  ] as const

  for (const relativeSchemaPath of relativeSchemaPaths) {
    const relativePath = path.join(cwd, relativeSchemaPath)
    debug(`Checking existence of ${relativePath}`)
    if (await exists(relativePath)) {
      debug('Found schema at', relativeSchemaPath)
      return relativeSchemaPath
    }
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

  const schemaPathResult = await getSchemaWithPath()
  if (!schemaPathResult) {
    return null
  }

  return path.dirname(schemaPathResult.schemaPath)
}

export async function getSchema(schemaPathFromArgs?: string): Promise<MultipleSchemas> {
  const schemaPathResult = await getSchemaWithPath(schemaPathFromArgs)

  if (!schemaPathResult) {
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

  return schemaPathResult.schemas
}

export function getSchemaPathFromPackageJsonSync(cwd: string): string | null {
  const pkgJson = readPackageUpSync({ cwd, normalize: false })
  const schemaPathFromPkgJson: string | undefined = pkgJson?.packageJson?.prisma?.['schema']

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

function isPkgJsonWorkspaceRoot(pkgJson: PackageJson) {
  const workspaces = pkgJson.workspaces

  if (!workspaces) {
    return false
  }

  return Array.isArray(workspaces) || workspaces.packages !== undefined
}

async function isNearestPkgJsonWorkspaceRoot(cwd: string) {
  const pkgJson = await readPackageUp({ cwd, normalize: false })

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
