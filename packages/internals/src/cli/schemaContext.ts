import { SchemaEngineConfigInternal } from '@prisma/config'
import { DataSource, GeneratorConfig } from '@prisma/generator'
import { GetSchemaResult, LoadedFile } from '@prisma/schema-files-loader'
import path from 'path'
import { match } from 'ts-pattern'

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
  schemaEngineConfig?: SchemaEngineConfigInternal
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
  allowNull?: boolean
  schemaPathArgumentName?: string
  cwd?: string
}

export async function loadSchemaContext(
  opts: LoadSchemaContextOptions & { allowNull: true },
): Promise<SchemaContext | null>
export async function loadSchemaContext(
  opts?: LoadSchemaContextOptions & { schemaEngineConfig: { engine: 'classic' } },
): Promise<Omit<SchemaContext, 'primaryDatasource'> & { primaryDatasource: DataSource }>
export async function loadSchemaContext(opts?: LoadSchemaContextOptions): Promise<SchemaContext>
export async function loadSchemaContext({
  schemaPathFromArg,
  schemaPathFromConfig,
  schemaEngineConfig,
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

  return processSchemaResult({ schemaResult, schemaEngineConfig, printLoadMessage, ignoreEnvVarErrors, cwd })
}

export async function processSchemaResult({
  schemaResult,
  schemaEngineConfig,
  printLoadMessage = true,
  ignoreEnvVarErrors = false,
  cwd = process.cwd(),
}: {
  schemaResult: GetSchemaResult
  schemaEngineConfig?: SchemaEngineConfigInternal
  printLoadMessage?: boolean
  ignoreEnvVarErrors?: boolean
  cwd?: string
}): Promise<SchemaContext> {
  const loadedFromPathForLogMessages = path.relative(cwd, schemaResult.schemaPath)
  const schemaRootDir = schemaResult.schemaRootDir || cwd

  if (printLoadMessage) {
    printSchemaLoadedMessage(loadedFromPathForLogMessages)
  }

  const configFromPsl = await getConfig({ datamodel: schemaResult.schemas, ignoreEnvVarErrors })

  const datasourceFromPsl = configFromPsl.datasources.at(0)

  const primaryDatasource = match(schemaEngineConfig)
    .with({ engine: 'classic' }, ({ datasource }) => {
      const { url, directUrl, shadowDatabaseUrl } = datasource

      const primaryDatasource = {
        ...datasourceFromPsl,
        url: { fromEnvVar: null, value: url },
        directUrl: directUrl ? { fromEnvVar: null, value: directUrl } : undefined,
        shadowDatabaseUrl: shadowDatabaseUrl ? { fromEnvVar: null, value: shadowDatabaseUrl } : undefined,
        [Symbol.for('engine.classic')]: true,
      } as DataSource

      return primaryDatasource
    })
    .otherwise(() => datasourceFromPsl)

  const primaryDatasourceDirectory = getPrimaryDatasourceDirectory(datasourceFromPsl) || schemaRootDir

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
