import path from 'node:path'

import { defineConfig } from '@prisma/config'

// Points the commands at the shadow database itself, so that a test can put something in it and
// look at what is left in it afterwards.
export default defineConfig({
  datasource: {
    url: 'file:shadow.db',
  },
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
