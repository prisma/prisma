import { WasmPanicRegistry } from '../src/WasmPanicRegistry'

declare global {
  /// Global registry for Wasm panics.
  // eslint-disable-next-line no-var
  var WASM_PANIC_REGISTRY: WasmPanicRegistry
}
