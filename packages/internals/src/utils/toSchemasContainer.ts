import path from 'path'

import { GetSchemaResult } from '../cli/getSchema'
import { MigrateTypes } from '../migrateTypes'
import { MultipleSchemas } from './schemaFileInput'

export function toSchemasContainer(schemas: MultipleSchemas): MigrateTypes.SchemasContainer {
  return {
    files: multipleSchemasToSchemaContainers(schemas),
  }
}

export function toSchemasWithConfigDir(getSchemaResult: GetSchemaResult): MigrateTypes.SchemasWithConfigDir {
  return {
    files: multipleSchemasToSchemaContainers(getSchemaResult.schemas),
    configDir: path.dirname(getSchemaResult.schemaPath),
  }
}

function multipleSchemasToSchemaContainers(schemas: MultipleSchemas): MigrateTypes.SchemaContainer[] {
  return schemas.map(([path, content]) => ({
    path,
    content,
  }))
}
