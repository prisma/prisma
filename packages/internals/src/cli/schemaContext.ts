import path from 'node:path'

import { ActiveConnectorType, DataSource, GeneratorConfig } from '@prisma/generator'
import { GetSchemaResult, LoadedFile } from '@prisma/schema-files-loader'

import { getConfig } from '../engine-commands'
import { getSchemaWithPath, getSchemaWithPathOptional, printSchemaLoadedMessage } from './getSchema'

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
   * TODO(prisma7): consider whether relative paths should be resolved relative to `prisma.config.ts` instead.
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
  /**
   * @deprecated Only used during the refactoring for backwards compatibility. Use `schemaFiles` instead or determine needed file paths otherwise.
   */
  schemaPath: string
}

type LoadSchemaContextOptions = {
  schemaPathFromArg?: string
  schemaPathFromConfig?: string
  printLoadMessage?: boolean
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

  return processSchemaResult({ schemaResult, printLoadMessage, cwd })
}

export async function processSchemaResult({
  schemaResult,
  printLoadMessage = true,
  cwd = process.cwd(),
}: {
  schemaResult: GetSchemaResult
  printLoadMessage?: boolean
  cwd?: string
}): Promise<SchemaContext> {
  const loadedFromPathForLogMessages = path.relative(cwd, schemaResult.schemaPath)
  const schemaRootDir = schemaResult.schemaRootDir || cwd

  if (printLoadMessage) {
    printSchemaLoadedMessage(loadedFromPathForLogMessages)
  }

  const configFromPsl = await getConfig({ datamodel: schemaResult.schemas })

  const primaryDatasource = configFromPsl.datasources.at(0)

  const primaryDatasourceDirectory = getPrimaryDatasourceDirectory(primaryDatasource) || schemaRootDir

  return {
    schemaFiles: schemaResult.schemas,
    schemaPath: schemaResult.schemaPath,
    schemaRootDir,
    datasources: configFromPsl.datasources,
    generators: configFromPsl.generators,
    primaryDatasource,
    primaryDatasourceDirectory,
    warnings: configFromPsl.warnings,
    loadedFromPathForLogMessages,
  }
}

function getPrimaryDatasourceDirectory(primaryDatasource: DataSource | undefined) {
  const datasourcePath = primaryDatasource?.sourceFilePath
  if (datasourcePath) {
    return path.dirname(datasourcePath)
  }
  return null
}

export function getSchemaDatasourceProvider(schemaContext: SchemaContext): ActiveConnectorType {
  if (schemaContext.primaryDatasource === undefined) {
    throw new Error('Schema must contain a datasource block')
  }
  return schemaContext.primaryDatasource.activeProvider
}
