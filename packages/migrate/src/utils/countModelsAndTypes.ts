import type { MigrateTypes } from '@prisma/internals'

type Counts = {
  modelsCount: number
  typesCount: number
}

export function countModelsAndTypes(schemas: MigrateTypes.SchemasContainer): Counts {
  let modelsCount = 0
  let typesCount = 0
  for (const file of schemas.files) {
    modelsCount += (file.content.match(/^model\s+/gm) || []).length
    typesCount += (file.content.match(/^type\s+/gm) || []).length
  }
  return { modelsCount, typesCount }
}
