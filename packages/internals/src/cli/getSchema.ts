import { Debug } from '@prisma/debug'
import { loadSchemaFiles, usesPrismaSchemaFolder } from '@prisma/schema-files-loader'
import execa from 'execa'
import fs from 'fs'
import { green } from 'kleur/colors'
import path from 'path'
import { PackageJson, readPackageUp } from 'read-package-up'
import { promisify } from 'util'

import { getConfig } from '../engine-commands'
import type { MultipleSchemas, MultipleSchemaTuple } from '../utils/schemaFileInput'

const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

const debug = Debug('prisma:getSchema')

type PathType = 'file' | 'directory'
type DefaultLocationPath = {
  path: string
  kind: PathType
}

type DefaultLookupRule = {
  schemaPath: DefaultLocationPath
  conflictsWith?: DefaultLocationPath
}

type SuccessfulLookupResult = {
  ok: true
  schema: GetSchemaResult
}

/// Non fatal error does not cause
/// abort of the lookup process and usually
/// means we should try next option. It will be turned into exception
/// only if all options are exhausted
type NonFatalLookupError =
  | {
      kind: 'NotFound'
      expectedType?: PathType
      path: string
    }
  | {
      kind: 'WrongType'
      path: string
      expectedTypes: PathType[]
    }
  | {
      kind: 'FolderPreviewNotEnabled'
      path: string
    }

type LookupResult =
  | SuccessfulLookupResult
  | {
      ok: false
      error: NonFatalLookupError
    }

type DefaultLookupRuleFailure = {
  rule: DefaultLookupRule
  error: NonFatalLookupError
}

type DefaultLookupError = {
  kind: 'NotFoundMultipleLocations'
  failures: DefaultLookupRuleFailure[]
}

type DefaultLookupResult =
  | SuccessfulLookupResult
  | {
      ok: false
      error: DefaultLookupError
    }

type PackageJsonLookupResult =
  | SuccessfulLookupResult
  | {
      ok: false
      error: {
        kind: 'PackageJsonNotConfigured'
      }
    }

type YarnWorkspaceLookupResult =
  | DefaultLookupResult
  | {
      ok: false
      error: {
        kind: 'Yarn1WorkspaceSchemaNotFound'
      }
    }

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

export type GetSchemaOptions = {
  cwd?: string
  argumentName?: string
}

type GetSchemaInternalOptions = Required<GetSchemaOptions>

/**
 * Loads the schema, throws an error if it is not found
 * @param schemaPathFromArgs
 * @param opts
 */
export async function getSchemaWithPath(
  schemaPathFromArgs?: string,
  { cwd = process.cwd(), argumentName = '--schema' }: GetSchemaOptions = {},
): Promise<GetSchemaResult> {
  const result = await getSchemaWithPathInternal(schemaPathFromArgs, { cwd, argumentName })
  if (result.ok) {
    return result.schema
  }
  throw new Error(renderDefaultLookupError(result.error, cwd))
}

/**
 * Loads the schema, returns null if it is not found
 * Throws an error if schema is specified explicitly in
 * any of the available ways (argument, package.json config), but
 * can not be loaded
 * @param schemaPathFromArgs
 * @param param1
 * @returns
 */
export async function getSchemaWithPathOptional(
  schemaPathFromArgs?: string,
  { cwd = process.cwd(), argumentName = '--schema' }: GetSchemaOptions = {},
): Promise<GetSchemaResult | null> {
  const result = await getSchemaWithPathInternal(schemaPathFromArgs, { cwd, argumentName })
  if (result.ok) {
    return result.schema
  }
  return null
}

export async function readSchemaFromSingleFile(schemaPath: string): Promise<LookupResult> {
  debug('Reading schema from single file', schemaPath)

  const typeError = await ensureType(schemaPath, 'file')
  if (typeError) {
    return { ok: false, error: typeError }
  }
  const file = await readFile(schemaPath, { encoding: 'utf-8' })
  const schemaTuple: MultipleSchemaTuple = [schemaPath, file]
  return {
    ok: true,
    schema: { schemaPath, schemaRootDir: path.dirname(schemaPath), schemas: [schemaTuple] },
  } as const
}

async function readSchemaFromDirectory(schemaPath: string): Promise<LookupResult> {
  debug('Reading schema from multiple files', schemaPath)
  const typeError = await ensureType(schemaPath, 'directory')
  if (typeError) {
    return { ok: false, error: typeError }
  }
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

  if (!usesPrismaSchemaFolder(config)) {
    return { ok: false, error: { kind: 'FolderPreviewNotEnabled', path: schemaPath } }
  }

  return { ok: true, schema: { schemaPath, schemaRootDir: schemaPath, schemas: files } }
}

async function ensureType(entryPath: string, expectedType: PathType): Promise<NonFatalLookupError | undefined> {
  try {
    const pathStat = await stat(entryPath)
    if (expectedType === 'file' && pathStat.isFile()) {
      return undefined
    }

    if (expectedType === 'directory' && pathStat.isDirectory()) {
      return undefined
    }

    return { kind: 'WrongType', path: entryPath, expectedTypes: [expectedType] }
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { kind: 'NotFound', path: entryPath, expectedType }
    }
    throw e
  }
}

async function readSchemaFromFileOrDirectory(schemaPath: string): Promise<LookupResult> {
  let stats: fs.Stats
  try {
    stats = await stat(schemaPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { ok: false, error: { kind: 'NotFound', path: schemaPath } }
    }
    throw e
  }

  if (stats.isFile()) {
    return readSchemaFromSingleFile(schemaPath)
  }

  if (stats.isDirectory()) {
    return readSchemaFromDirectory(schemaPath)
  }

  return { ok: false, error: { kind: 'WrongType', path: schemaPath, expectedTypes: ['file', 'directory'] } }
}

/**
 * Tries to load schema from either provided
 * arg, package.json configured location, default location
 * relative to cwd or any of the Yarn1Workspaces.
 *
 * If schema is specified explicitly with any of the methods but can
 * not be loaded, error will be thrown. If no explicit schema is given, than
 * error value will be returned instead
 */
async function getSchemaWithPathInternal(
  schemaPathFromArgs: string | undefined,
  { cwd, argumentName }: GetSchemaInternalOptions,
) {
  // 1. Try the user custom path, when provided.
  if (schemaPathFromArgs) {
    const absPath = path.resolve(cwd, schemaPathFromArgs)
    const customSchemaResult = await readSchemaFromFileOrDirectory(absPath)
    if (!customSchemaResult.ok) {
      const relPath = path.relative(cwd, absPath)
      throw new Error(
        `Could not load \`${argumentName}\` from provided path \`${relPath}\`: ${renderLookupError(
          customSchemaResult.error,
        )}`,
      )
    }

    return customSchemaResult
  }

  const pkgJsonResult = await getSchemaFromPackageJson(cwd)
  if (pkgJsonResult.ok) {
    return pkgJsonResult
  }

  const defaultResult = await getDefaultSchema(cwd)
  if (defaultResult.ok) {
    return defaultResult
  }

  const yarnResult = await getSchemaFromYarn1Workspace(cwd, defaultResult.error.failures)
  if (yarnResult.ok) {
    return yarnResult
  }

  const finalError = yarnResult.error.kind === 'Yarn1WorkspaceSchemaNotFound' ? defaultResult.error : yarnResult.error
  return {
    ok: false as const,
    error: finalError,
  }
}

function renderLookupError(error: NonFatalLookupError) {
  switch (error.kind) {
    case 'NotFound': {
      const expected = error.expectedType ?? 'file or directory'
      return `${expected} not found`
    }
    case 'FolderPreviewNotEnabled':
      return `"prismaSchemaFolder" preview feature must be enabled`
    case 'WrongType':
      return `expected ${error.expectedTypes.join(' or ')}`
  }
}

function renderDefaultLookupError(error: DefaultLookupError, cwd: string) {
  const parts: string[] = [
    `Could not find Prisma Schema that is required for this command.`,
    `You can either provide it with ${green(
      '`--schema`',
    )} argument, set it as \`prisma.schema\` in your package.json or put it into the default location.`,
    'Checked following paths:\n',
  ]
  const printedPaths = new Set<string>()
  for (const failure of error.failures) {
    const filePath = failure.rule.schemaPath.path
    if (!printedPaths.has(failure.rule.schemaPath.path)) {
      parts.push(`${path.relative(cwd, filePath)}: ${renderLookupError(failure.error)}`)
      printedPaths.add(filePath)
    }
  }
  parts.push('\nSee also https://pris.ly/d/prisma-schema-location')
  return parts.join('\n')
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

export async function getSchemaFromPackageJson(cwd: string): Promise<PackageJsonLookupResult> {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)
  debug('prismaConfig', prismaConfig)

  if (!prismaConfig || !prismaConfig.data?.schema) {
    return { ok: false, error: { kind: 'PackageJsonNotConfigured' } }
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

  const lookupResult = await readSchemaFromFileOrDirectory(absoluteSchemaPath)

  if (!lookupResult.ok) {
    throw new Error(
      `Could not load schema from \`${path.relative(
        cwd,
        absoluteSchemaPath,
      )}\` provided by "prisma.schema" config of \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\`: ${renderLookupError(lookupResult.error)}`,
    )
  }
  return lookupResult
}

async function getSchemaFromYarn1Workspace(
  cwd: string,
  pastFailures: DefaultLookupRuleFailure[],
): Promise<YarnWorkspaceLookupResult> {
  if (!process.env.npm_config_user_agent?.includes('yarn')) {
    return { ok: false, error: { kind: 'Yarn1WorkspaceSchemaNotFound' } }
  }

  let workspaces: Array<{ location: string }>
  try {
    const { stdout: version } = await execa.command('yarn --version', {
      cwd,
    })

    if (version.startsWith('2')) {
      return { ok: false, error: { kind: 'Yarn1WorkspaceSchemaNotFound' } }
    }
    const { stdout } = await execa.command('yarn workspaces info --json', {
      cwd,
    })
    const json = getJson(stdout)
    workspaces = Object.values(json)
  } catch {
    return { ok: false, error: { kind: 'Yarn1WorkspaceSchemaNotFound' } }
  }

  const workspaceRootDir = await findWorkspaceRoot(cwd)

  if (!workspaceRootDir) {
    return { ok: false, error: { kind: 'Yarn1WorkspaceSchemaNotFound' } }
  }

  // Iterate over the workspaces
  for (const workspace of workspaces) {
    const workspacePath = path.join(workspaceRootDir, workspace.location)
    const workspaceSchema = await tryWorkspacePath(workspacePath, pastFailures)

    if (workspaceSchema.ok) {
      return workspaceSchema
    }
  }

  const rootPathSchema = await tryWorkspacePath(workspaceRootDir, pastFailures)
  return rootPathSchema
}

async function tryWorkspacePath(cwd: string, pastFailures: DefaultLookupRuleFailure[]) {
  const pkgJson = await getSchemaFromPackageJson(cwd)
  if (pkgJson.ok) {
    return pkgJson
  }

  return getDefaultSchema(cwd, pastFailures)
}

async function getDefaultSchema(cwd: string, failures: DefaultLookupRuleFailure[] = []): Promise<DefaultLookupResult> {
  const schemaPrisma: DefaultLookupRule = {
    schemaPath: {
      path: path.join(cwd, 'schema.prisma'),
      kind: 'file',
    },
  }
  const prismaSchemaFile: DefaultLookupRule = {
    schemaPath: {
      path: path.join(cwd, 'prisma', 'schema.prisma'),
      kind: 'file',
    },
    conflictsWith: {
      path: path.join(cwd, 'prisma', 'schema'),
      kind: 'directory',
    },
  }

  const prismaSchemaFolder: DefaultLookupRule = {
    schemaPath: {
      path: path.join(cwd, 'prisma', 'schema'),
      kind: 'directory',
    },
    conflictsWith: {
      path: path.join(cwd, 'prisma', 'schema.prisma'),
      kind: 'file',
    },
  }

  const rules = [schemaPrisma, prismaSchemaFile, prismaSchemaFolder]
  for (const rule of rules) {
    debug(`Checking existence of ${rule.schemaPath.path}`)
    const schema = await loadSchemaFromDefaultLocation(rule.schemaPath)
    if (!schema.ok) {
      failures.push({ rule, error: schema.error })
      continue
    }
    if (rule.conflictsWith) {
      const conflictingSchema = await loadSchemaFromDefaultLocation(rule.conflictsWith)
      if (conflictingSchema.ok) {
        throw new Error(
          `Found Prisma Schemas at both \`${path.relative(cwd, rule.schemaPath.path)}\` and \`${path.relative(
            cwd,
            rule.conflictsWith.path,
          )}\`. Please remove one.`,
        )
      }
    }
    return schema
  }

  return {
    ok: false,
    error: {
      kind: 'NotFoundMultipleLocations',
      failures,
    },
  }
}

async function loadSchemaFromDefaultLocation(lookupPath: DefaultLocationPath) {
  switch (lookupPath.kind) {
    case 'file':
      return readSchemaFromSingleFile(lookupPath.path)
    case 'directory':
      return readSchemaFromDirectory(lookupPath.path)
  }
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

  return schemaPathResult.schemas
}

function getJson(stdout: string): any {
  const firstCurly = stdout.indexOf('{')
  const lastCurly = stdout.lastIndexOf('}')
  const sliced = stdout.slice(firstCurly, lastCurly + 1)
  return JSON.parse(sliced)
}

export async function findNearestPackageJson(cwd?: string): Promise<{ path: string; data: PackageJson } | null> {
  const pkgJson = await readPackageUp({ cwd, normalize: false })

  if (!pkgJson) {
    return null
  }

  return {
    path: pkgJson.path,
    data: pkgJson.packageJson,
  }
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
