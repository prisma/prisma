import path from 'node:path'

import { defineConfig } from '@prisma/config'

const basePath = process.cwd()

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: `file:${path.join(basePath, 'dev.db')}`,
  },
  schema: path.join(basePath, 'prisma', 'using-file-as-url.prisma'),
})
