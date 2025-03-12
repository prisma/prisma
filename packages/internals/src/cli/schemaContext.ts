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
   * The datasources extracted from the Prisma schema.
   */
  datasources: DataSource[] | []
  /**
   * The generators extracted from the Prisma schema.
   */
  generators: GeneratorConfig[] | []
  // @deprecated Only used during the refactoring for backwards compatibility. Use `schemaFiles` instead or determine needed file paths otherwise.
  schemaPath: string
}

export async function loadSchemaContextOptional({
  schemaPathFromArg,
  schemaPathFromConfig,
  printLoadMessage = true,
}: {
  schemaPathFromArg: string | undefined
  schemaPathFromConfig: SchemaPathFromConfig | undefined
  printLoadMessage?: boolean
}): Promise<SchemaContext | null> {
  const schemaWithPath = await getSchemaWithPathOptional(schemaPathFromArg, schemaPathFromConfig)

  if (!schemaWithPath) {
    return null
  }

  return processSchemaResult({ schemaWithPath, printLoadMessage })
}

export async function loadSchemaContext({
  schemaPathFromArg,
  schemaPathFromConfig,
  printLoadMessage = true,
}: {
  schemaPathFromArg: string | undefined
  schemaPathFromConfig: SchemaPathFromConfig | undefined
  printLoadMessage?: boolean
}): Promise<SchemaContext> {
  const schemaWithPath = await getSchemaWithPath(schemaPathFromArg, schemaPathFromConfig)

  return processSchemaResult({ schemaWithPath, printLoadMessage })
}

async function processSchemaResult({
  schemaWithPath,
  printLoadMessage,
}: {
  schemaWithPath: GetSchemaResult
  printLoadMessage: boolean
}) {
  const loadedFromPathForLogMessages = path.relative(process.cwd(), schemaWithPath.schemaPath)

  if (printLoadMessage) {
    process.stdout.write(dim(`Prisma schema loaded from ${loadedFromPathForLogMessages}`) + '\n')
  }

  const configFromPsl = await getConfig({ datamodel: schemaWithPath.schemas })

  return {
    schemaFiles: schemaWithPath.schemas,
    schemaPath: schemaWithPath.schemaPath,
    schemaRootDir: schemaWithPath.schemaRootDir,
    datasources: configFromPsl.datasources,
    generators: configFromPsl.generators,
    primaryDatasourceDirectory: primaryDatasourceDirectory(configFromPsl.datasources, schemaWithPath.schemaRootDir),
    loadedFromPathForLogMessages,
  }
}

function primaryDatasourceDirectory(datasources: DataSource[], schemaRootDir: string) {
  const datasourcePath = datasources[0]?.sourceFilePath
  if (datasourcePath) {
    return path.dirname(datasourcePath)
  }
  return schemaRootDir || process.cwd()
}
