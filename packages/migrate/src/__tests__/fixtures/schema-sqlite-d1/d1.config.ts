import { defineConfig } from '@prisma/config'
import { listLocalDatabases } from '@prisma/adapter-d1'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: `file://${listLocalDatabases().pop()}`,
  },
})
