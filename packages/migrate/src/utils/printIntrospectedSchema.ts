import type { MigrateTypes } from '@prisma/internals'
import path from 'node:path'
import type { Writable } from 'node:stream'

export function printIntrospectedSchema(schema: MigrateTypes.SchemasContainer, out: Writable) {
  if (schema.files.length === 1) {
    out.write(`${schema.files[0].content}\n`)
    return
  }
  // produce stable results
  const sortedFiles = schema.files.sort((a, b) => a.path.localeCompare(b.path))
  for (const file of sortedFiles) {
    const relPath = path.relative(process.cwd(), file.path)
    out.write(`// ${relPath}\n${file.content}\n`)
  }
}
