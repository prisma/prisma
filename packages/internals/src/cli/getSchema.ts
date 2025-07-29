import { loadConfigFromPackageJson } from '@prisma/config'
import { Debug } from '@prisma/debug'
import type {
  GetSchemaResult,
  LookupResult,
  NonFatalLookupError,
  SuccessfulLookupResult,
} from '@prisma/schema-files-loader'
import { ensureType, loadSchemaFiles } from '@prisma/schema-files-loader'
import fs from 'fs'
import { dim, green } from 'kleur/colors'
import path from 'path'
import { promisify } from 'util'

import type { MultipleSchemaTuple } from '../utils/schemaFileInput'

const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

const debug = Debug('prisma:getSchema')

type DefaultLookupRuleFailure = {
  path: string
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

export type GetSchemaOptions = {
  cwd?: string
  argumentName?: string
}

type GetSchemaInternalOptions = Required<GetSchemaOptions>

/**
 * Loads the schema, throws an error if it is not found
 * @param schemaPathFromArgs
 * @param schemaPathFromConfig
 * @param opts
 */
export async function getSchemaWithPath(
  schemaPathFromArgs?: string,
  schemaPathFromConfig?: string,
  { cwd = process.cwd(), argumentName = '--schema' }: GetSchemaOptions = {},
): Promise<GetSchemaResult> {
  const result = await getSchemaWithPathInternal(schemaPathFromArgs, schemaPathFromConfig, { cwd, argumentName })
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
 * @param schemaPathFromConfig
 * @param opts
 * @returns
 */
export async function getSchemaWithPathOptional(
  schemaPathFromArgs?: string,
  schemaPathFromConfig?: string,
  { cwd = process.cwd(), argumentName = '--schema' }: GetSchemaOptions = {},
): Promise<GetSchemaResult | null> {
  const result = await getSchemaWithPathInternal(schemaPathFromArgs, schemaPathFromConfig, { cwd, argumentName })
  if (result.ok) {
    return result.schema
  }
  return null
}

export function printSchemaLoadedMessage(schemaPath: string) {
  // TODO: this causes https://github.com/prisma/prisma/issues/27005
  process.stdout.write(dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`) + '\n')
}

async function readSchemaFromSingleFile(schemaPath: string): Promise<LookupResult> {
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
  return { ok: true, schema: { schemaPath, schemaRootDir: schemaPath, schemas: files } }
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
 * arg, package.json configured location, prisma.config.ts location,
 * default location relative to cwd or any of the Yarn1Workspaces.
 *
 * If schema is specified explicitly with any of the methods but can
 * not be loaded, error will be thrown. If no explicit schema is given, then
 * error value will be returned instead
 */
async function getSchemaWithPathInternal(
  schemaPathFromArgs: string | undefined,
  schemaPathFromConfig: string | undefined,
  { cwd, argumentName }: GetSchemaInternalOptions,
): Promise<DefaultLookupResult> {
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

  // 2. Try the `schema` from `PrismaConfig`
  const prismaConfigResult = await readSchemaFromPrismaConfigBasedLocation(schemaPathFromConfig)
  if (prismaConfigResult.ok) {
    return prismaConfigResult
  }

  // 3. Use the "prisma"."schema" attribute from the project's package.json
  const pkgJsonResult = await getSchemaFromPackageJson(cwd)
  if (pkgJsonResult.ok) {
    return pkgJsonResult
  }

  // 4. Look into the default, "canonical" locations in the cwd (e.g., `./schema.prisma` or `./prisma/schema.prisma`)
  const defaultResult = await getDefaultSchema(cwd)
  if (defaultResult.ok) {
    return defaultResult
  }

  return {
    ok: false as const,
    error: defaultResult.error,
  }
}

function renderLookupError(error: NonFatalLookupError) {
  switch (error.kind) {
    case 'NotFound': {
      const expected = error.expectedType ?? 'file or directory'
      return `${expected} not found`
    }
    case 'WrongType':
      return `expected ${error.expectedTypes.join(' or ')}`
  }
}

function renderDefaultLookupError(error: DefaultLookupError, cwd: string) {
  const parts: string[] = [
    `Could not find Prisma Schema that is required for this command.`,
    `You can either provide it with ${green('`--schema`')} argument,`,
    `set it in your Prisma Config file (e.g., ${green('`prisma.config.ts`')}),`,
    `set it as ${green('`prisma.schema`')} in your ${green('package.json')},`,
    `or put it into the default location (${green('`./prisma/schema.prisma`')}, or ${green('`./schema.prisma`')}.`,
    'Checked following paths:\n',
  ]
  const printedPaths = new Set<string>()
  for (const failure of error.failures) {
    const filePath = failure.path
    if (!printedPaths.has(failure.path)) {
      parts.push(`${path.relative(cwd, filePath)}: ${renderLookupError(failure.error)}`)
      printedPaths.add(filePath)
    }
  }
  parts.push('\nSee also https://pris.ly/d/prisma-schema-location')
  return parts.join('\n')
}

async function readSchemaFromPrismaConfigBasedLocation(schemaPathFromConfig: string | undefined) {
  if (!schemaPathFromConfig) {
    return {
      ok: false,
      error: { kind: 'PrismaConfigNotConfigured' },
    } as const
  }

  const schemaResult = await readSchemaFromFileOrDirectory(schemaPathFromConfig)

  if (!schemaResult.ok) {
    throw new Error(
      `Could not load schema from \`${schemaPathFromConfig}\` provided by "prisma.config.ts"\`: ${renderLookupError(
        schemaResult.error,
      )}`,
    )
  }

  return schemaResult
}

/**
 * Trying to access this function results in a deprecation warning.
 * Users should be instructed to use the Prisma config file instead.
 * See: https://pris.ly/prisma-config.
 * @deprecated
 */
export async function getSchemaFromPackageJson(cwd: string): Promise<PackageJsonLookupResult> {
  const prismaConfig = await loadConfigFromPackageJson(cwd)
  debug('prismaConfig', prismaConfig)

  if (!prismaConfig || !prismaConfig.config?.schema) {
    return { ok: false, error: { kind: 'PackageJsonNotConfigured' } }
  }

  const schemaPathFromPkgJson = prismaConfig.config.schema

  if (typeof schemaPathFromPkgJson !== 'string') {
    throw new Error(
      `Provided schema path \`${schemaPathFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.loadedFromFile,
      )}\` must be of type string`,
    )
  }

  const absoluteSchemaPath = path.isAbsolute(schemaPathFromPkgJson)
    ? schemaPathFromPkgJson
    : path.resolve(path.dirname(prismaConfig.loadedFromFile), schemaPathFromPkgJson)

  const lookupResult = await readSchemaFromFileOrDirectory(absoluteSchemaPath)

  if (!lookupResult.ok) {
    throw new Error(
      `Could not load schema from \`${path.relative(
        cwd,
        absoluteSchemaPath,
      )}\` provided by "prisma.schema" config of \`${path.relative(
        cwd,
        prismaConfig.loadedFromFile,
      )}\`: ${renderLookupError(lookupResult.error)}`,
    )
  }
  return lookupResult
}

async function getDefaultSchema(cwd: string, failures: DefaultLookupRuleFailure[] = []): Promise<DefaultLookupResult> {
  const lookupPaths = [path.join(cwd, 'schema.prisma'), path.join(cwd, 'prisma', 'schema.prisma')]
  for (const path of lookupPaths) {
    debug(`Checking existence of ${path}`)
    const schema = await readSchemaFromSingleFile(path)
    if (!schema.ok) {
      failures.push({ path, error: schema.error })
      continue
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
