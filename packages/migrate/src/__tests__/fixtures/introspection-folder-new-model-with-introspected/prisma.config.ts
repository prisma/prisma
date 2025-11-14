import path from 'node:path'

import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'file:dev.db',
  },
  // TODO: why doesn't a relative schema path work in this test?
  schema: path.join(__dirname, 'prisma', 'schema'),
})
