import type { RustError, RustLog } from '../utils/log'

export type PrismaClientRustErrorArgs = {
  clientVersion: string
  error: RustLog | RustError
}
