import path from 'node:path'

import { defineConfig, env } from '@prisma/config'

const basePath = process.cwd()

export default defineConfig({
  engine: 'classic',
  schema: path.join(basePath, 'schema.prisma'),
  datasource: {
    url: 'invalid-url',
  },
})
