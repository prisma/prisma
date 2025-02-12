import path from 'node:path'
import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: 'multi',
    folder: path.join('prisma', 'schema'),
  },
})
