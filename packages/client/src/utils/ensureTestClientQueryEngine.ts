import type { BinaryTarget } from '@prisma/get-platform'
import { ClientEngineType } from '@prisma/internals'

/**
 * Client engine no longer requires downloading query engine binaries
 * @param clientEngineType
 * @param binaryTarget
 */
export async function ensureTestClientQueryEngine(_clientEngineType: ClientEngineType, _binaryTarget: BinaryTarget) {
  // No-op: Client engine handles this internally
}
