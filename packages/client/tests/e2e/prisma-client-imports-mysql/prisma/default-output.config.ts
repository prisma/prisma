import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'prisma/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  engine: 'classic',
  schema: path.join(__dirname, 'default-output.prisma'),
  datasource: {
    url: 'mysql://prisma:prisma@localhost:3306/prisma',
  },
})
