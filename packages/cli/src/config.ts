// export type { PrismaConfig } from '@prisma/config'

// Workaround for a TypeScript bug, see: https://github.com/microsoft/TypeScript/issues/58914#issuecomment-2527394654
import type {} from 'effect'

export type PrismaConfig = {
  earlyAccess: true
}
