import fs from 'fs'
import path from 'path'

import { getSchemaPathSync } from '@prisma/cli'

export function getDatamodelPath(projectDir: string): string {
  if (projectDir) {
    if (fs.existsSync(path.join(projectDir, 'schema.prisma'))) {
      return path.join(projectDir, 'schema.prisma')
    }
    if (fs.existsSync(path.join(projectDir, 'prisma/schema.prisma'))) {
      return path.join(projectDir, 'prisma/schema.prisma')
    }
  }

  const schemaPath = getSchemaPathSync()
  if (!schemaPath) {
    throw new Error(`Could not find schema.prisma in ${projectDir}`)
  }

  return schemaPath
}
