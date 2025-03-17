import { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { GetSchemaResult, LoadedFile } from '@prisma/schema-files-loader'
import { dim } from 'kleur/colors'
import path from 'path'

import { getConfig } from '../engine-commands'
import { getSchemaWithPath, getSchemaWithPathOptional, SchemaPathFromConfig } from './getSchema'

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
  schemaPathFromConfig?: SchemaPathFromConfig
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
  allowNull?: boolean
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
}: LoadSchemaContextOptions = {}): Promise<SchemaContext | null> {
  let schemaResult: GetSchemaResult | null = null

  if (allowNull) {
    schemaResult = await getSchemaWithPathOptional(schemaPathFromArg, schemaPathFromConfig)
    if (!schemaResult) return null
  } else {
    schemaResult = await getSchemaWithPath(schemaPathFromArg, schemaPathFromConfig)
  }

  return processSchemaResult({ schemaResult, printLoadMessage, ignoreEnvVarErrors })
}

export async function processSchemaResult({
  schemaResult,
  printLoadMessage = true,
  ignoreEnvVarErrors = false,
}: {
  schemaResult: GetSchemaResult
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
}): Promise<SchemaContext> {
  const cwd = process.cwd()

  const loadedFromPathForLogMessages = path.relative(cwd, schemaResult.schemaPath)

  if (printLoadMessage) {
    process.stdout.write(dim(`Prisma schema loaded from ${loadedFromPathForLogMessages}`) + '\n')
  }

  const configFromPsl = await getConfig({ datamodel: schemaResult.schemas, ignoreEnvVarErrors })

  const primaryDatasource = configFromPsl.datasources.at(0)

  return {
    schemaFiles: schemaResult.schemas,
    schemaPath: schemaResult.schemaPath,
    schemaRootDir: schemaResult.schemaRootDir || cwd,
    datasources: configFromPsl.datasources,
    generators: configFromPsl.generators,
    primaryDatasource,
    primaryDatasourceDirectory: primaryDatasourceDirectory(primaryDatasource) || schemaResult.schemaRootDir || cwd,
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
