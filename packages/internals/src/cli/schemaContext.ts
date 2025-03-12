import { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { GetSchemaResult, LoadedFile } from '@prisma/schema-files-loader'
import { dim } from 'kleur/colors'
import path from 'path'

import { getConfig } from '../engine-commands'
import { getSchemaWithPath, getSchemaWithPathOptional, SchemaPathFromConfig } from './getSchema'

export type SchemaContext = {
  schemaFiles: LoadedFile[]
  schemaRootDir: string
  primaryDatasourceDirectory: string
  // @deprecated Only used during the refactoring for backwards compatibility. Use `schemaFiles` instead or determine needed file paths otherwise.
  schemaPath: string
  datasources: DataSource[] | []
  generators: GeneratorConfig[] | []
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
  if (printLoadMessage) {
    process.stdout.write(
      dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaWithPath.schemaPath)}`) + '\n',
    )
  }

  const configFromPsl = await getConfig({ datamodel: schemaWithPath.schemas })

  return {
    schemaFiles: schemaWithPath.schemas,
    schemaPath: schemaWithPath.schemaPath,
    schemaRootDir: schemaWithPath.schemaRootDir,
    datasources: configFromPsl.datasources,
    generators: configFromPsl.generators,
    primaryDatasourceDirectory: primaryDatasourceDirectory(configFromPsl.datasources, schemaWithPath.schemaRootDir),
  }
}

function primaryDatasourceDirectory(datasources: DataSource[], schemaRootDir: string) {
  const datasourcePath = datasources[0]?.sourceFilePath
  if (datasourcePath) {
    return path.dirname(datasourcePath)
  }
  return schemaRootDir || process.cwd()
}
