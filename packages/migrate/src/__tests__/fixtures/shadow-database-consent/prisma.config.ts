import path from 'node:path'

import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'file:main.db',
    shadowDatabaseUrl: 'file:shadow.db',
  },
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
