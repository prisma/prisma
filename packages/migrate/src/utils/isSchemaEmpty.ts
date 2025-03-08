import type { MigrateTypes } from '@prisma/internals'

export function isSchemaEmpty(schemas: MigrateTypes.SchemasContainer | undefined): boolean {
  if (!schemas) {
    return true
  }
  return schemas.files.every((schema) => schema.content.trim() === '')
}
