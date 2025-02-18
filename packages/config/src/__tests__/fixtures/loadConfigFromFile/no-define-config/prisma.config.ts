import type { PrismaConfig } from 'src/index'

export default {
  earlyAccess: true,
  schema: {
    kind: 'single',
    filePath: 'schema.prisma',
  },
} satisfies PrismaConfig
