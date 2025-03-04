import fs from 'node:fs/promises'

import type { MultipleSchemas } from '@prisma/internals'

export async function removeSchemaFiles(files: MultipleSchemas) {
  await Promise.all(files.map(([path]) => fs.rm(path)))
}
