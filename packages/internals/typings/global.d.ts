import type { ParsedEnv } from '../src/utils/tryLoadEnvs'
import type { WasmPanicRegistry } from '../src/WasmPanicRegistry'

declare global {
  /// Global registry for Wasm panics.
  // eslint-disable-next-line no-var
  var PRISMA_WASM_PANIC_REGISTRY: WasmPanicRegistry

  /// Global registry for `process.env` + `dotenv`.
  // eslint-disable-next-line no-var
  var PRISMA_PROCESS_ENV: ParsedEnv
}
