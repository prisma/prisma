import fs from 'node:fs/promises'

import type { MigrateTypes } from '@prisma/internals'

export async function saveSchemaFiles(schemas: MigrateTypes.SchemasContainer) {
  await Promise.all(schemas.files.map((file) => fs.writeFile(file.path, file.content, 'utf8')))
}
