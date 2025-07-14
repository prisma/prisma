import Debug from '@prisma/debug'
import { DataSource, GeneratorConfig } from '@prisma/generator'
import { GetSchemaResult, LoadedFile } from '@prisma/schema-files-loader'
import path from 'path'

import { getConfig } from '../engine-commands'
import { getSchemaWithPath, getSchemaWithPathOptional, printSchemaLoadedMessage } from './getSchema'

const debug = Debug('prisma:cli:schemaContext')

export type SchemaContext = {
  /**
   * All loaded schema files and their paths.
   */
  schemaFiles: LoadedFile[]
  /**
   * The root directory of the schema files.
   * Either set explicitly from a schema folder based config or the parent directory of the schema.prisma file.
   */
  schemaRootDir: string
  /**
   * The directory of the schema.prisma file that contains the datasource block.
   * Some relative paths like SQLite paths or SSL file paths are resolved relative to it.
   */
  primaryDatasourceDirectory: string
  /**
   * The path that shall be printed in user facing logs messages informing them from where the schema was loaded.
   */
  loadedFromPathForLogMessages: string
  /**
   * The datasource extracted from the Prisma schema. So far we only support a single datasource block.
   */
  primaryDatasource: DataSource | undefined
  /**
   * Warnings that were raised during Prisma schema parsing.
   */
  warnings: string[] | []
  /**
   * The datasources extracted from the Prisma schema. Prefer to use primaryDatasource for most cases.
   */
  datasources: DataSource[] | []
  /**
   * The generators extracted from the Prisma schema.
   */
  generators: GeneratorConfig[] | []
  // @deprecated Only used during the refactoring for backwards compatibility. Use `schemaFiles` instead or determine needed file paths otherwise.
  schemaPath: string
}

type LoadSchemaContextOptions = {
  schemaPathFromArg?: string
  schemaPathFromConfig?: string
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
  allowNull?: boolean
  schemaPathArgumentName?: string
  cwd?: string
}

export async function loadSchemaContext(
  opts: LoadSchemaContextOptions & { allowNull: true },
): Promise<SchemaContext | null>
export async function loadSchemaContext(opts?: LoadSchemaContextOptions): Promise<SchemaContext>
export async function loadSchemaContext({
  schemaPathFromArg,
  schemaPathFromConfig,
  printLoadMessage = true,
  ignoreEnvVarErrors = false,
  allowNull = false,
  schemaPathArgumentName = '--schema',
  cwd = process.cwd(),
}: LoadSchemaContextOptions = {}): Promise<SchemaContext | null> {
  let schemaResult: GetSchemaResult | null = null

  if (allowNull) {
    schemaResult = await getSchemaWithPathOptional(schemaPathFromArg, schemaPathFromConfig, {
      argumentName: schemaPathArgumentName,
      cwd,
    })
    if (!schemaResult) return null
  } else {
    schemaResult = await getSchemaWithPath(schemaPathFromArg, schemaPathFromConfig, {
      argumentName: schemaPathArgumentName,
      cwd,
    })
  }

  return processSchemaResult({ schemaResult, printLoadMessage, ignoreEnvVarErrors, cwd })
}

export async function processSchemaResult({
  schemaResult,
  printLoadMessage = true,
  ignoreEnvVarErrors = false,
  cwd = process.cwd(),
}: {
  schemaResult: GetSchemaResult
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
  cwd?: string
}): Promise<SchemaContext> {
  const loadedFromPathForLogMessages = path.relative(cwd, schemaResult.schemaPath)

  if (printLoadMessage) {
    printSchemaLoadedMessage(loadedFromPathForLogMessages)
  }

  debug('processSchemaResult with ignoreEnvVarErrors=%s:\n%s', ignoreEnvVarErrors, schemaResult.schemas)
  const configFromPsl = await getConfig({ datamodel: schemaResult.schemas, ignoreEnvVarErrors })

  const primaryDatasource = configFromPsl.datasources.at(0)
  const schemaRootDir = schemaResult.schemaRootDir || cwd

  return {
    schemaFiles: schemaResult.schemas,
    schemaPath: schemaResult.schemaPath,
    schemaRootDir,
    datasources: configFromPsl.datasources,
    generators: configFromPsl.generators,
    primaryDatasource,
    primaryDatasourceDirectory: primaryDatasourceDirectory(primaryDatasource) || schemaRootDir,
    warnings: configFromPsl.warnings,
    loadedFromPathForLogMessages,
  }
}

function primaryDatasourceDirectory(primaryDatasource: DataSource | undefined) {
  const datasourcePath = primaryDatasource?.sourceFilePath
  if (datasourcePath) {
    return path.dirname(datasourcePath)
  }
  return null
}
