import type { IsolationLevel } from '@prisma/driver-adapter-utils'

export type Options = {
  maxWait?: number
  timeout?: number
  isolationLevel?: IsolationLevel
}

export type TransactionInfo = {
  id: string
}
