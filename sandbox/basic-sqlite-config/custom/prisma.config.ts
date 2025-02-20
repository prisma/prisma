import path from 'node:path'
import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,

  schema: {
    kind: 'multi',
    folderPath: path.join('prisma', 'schema'),
  },
})
