import path from 'node:path'
import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: 'single',
    filePath: path.join('custom', 'prisma', 'schema.prisma'),
  },
})
