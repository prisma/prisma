import path from 'node:path'

import { defineConfig } from '@prisma/config'

throw new Error(`test: ${path.join(__dirname, 'prisma', 'schema')}`)

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'file:../../dev.db',
  },
  schema: path.join(__dirname, 'prisma', 'schema'),
})
