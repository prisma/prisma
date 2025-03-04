import type { GetSchemaResult } from '@prisma/schema-files-loader'

import type { ConfigMetaFormat } from '../engine-commands'
import type { MigrateTypes } from '../migrateTypes'
import { getMigrateConfigDir } from './getMigrateConfigDir'
import type { MultipleSchemas } from './schemaFileInput'

export function toSchemasContainer(schemas: MultipleSchemas): MigrateTypes.SchemasContainer {
  return {
    files: multipleSchemasToSchemaContainers(schemas),
  }
}

export function toSchemasWithConfigDir(
  getSchemaResult: GetSchemaResult,
  config: ConfigMetaFormat,
): MigrateTypes.SchemasWithConfigDir {
  return {
    files: multipleSchemasToSchemaContainers(getSchemaResult.schemas),
    configDir: getMigrateConfigDir(config, getSchemaResult.schemaPath),
  }
}

function multipleSchemasToSchemaContainers(schemas: MultipleSchemas): MigrateTypes.SchemaContainer[] {
  return schemas.map(([path, content]) => ({
    path,
    content,
  }))
}
