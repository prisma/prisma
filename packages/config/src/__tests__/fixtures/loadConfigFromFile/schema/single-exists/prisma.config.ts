import path from 'node:path'
import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: 'single',
    filenamePath: path.join('prisma', 'schema.prisma'),
  },
})
