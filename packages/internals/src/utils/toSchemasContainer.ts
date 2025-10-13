import { SchemaContext } from '../cli/schemaContext'
import { MigrateTypes } from '../migrateTypes'
import { MultipleSchemas } from './schemaFileInput'

export function toSchemasContainer(schemas: MultipleSchemas): MigrateTypes.SchemasContainer {
  return {
    files: multipleSchemasToSchemaContainers(schemas),
  }
}

export function toSchemasWithConfigDir(schemaContext: SchemaContext): MigrateTypes.SchemasWithConfigDir {
  return {
    files: multipleSchemasToSchemaContainers(schemaContext.schemaFiles),
    configDir: schemaContext.primaryDatasourceDirectory,
  }
}

function multipleSchemasToSchemaContainers(schemas: MultipleSchemas): MigrateTypes.SchemaContainer[] {
  return schemas.map(([path, content]) => ({
    path,
    content,
  }))
}
