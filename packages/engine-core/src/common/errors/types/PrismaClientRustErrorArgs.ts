import { RustLog, RustError } from '../utils/log'

export type PrismaClientRustErrorArgs = {
  clientVersion: string
  log?: RustLog
  error?: RustError
}
