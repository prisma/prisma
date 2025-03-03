import path from 'node:path'
import type { PrismaConfig } from 'prisma'

export default {
  earlyAccess: true,
  schema: {
    kind: 'single',
    filePath: path.join('custom', 'prisma', 'schema.prisma'),
  },
} satisfies PrismaConfig
