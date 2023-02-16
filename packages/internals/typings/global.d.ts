import { WasmPanicRegistry } from '../src/WasmPanicRegistry'

declare global {
  /// Global registry for Wasm panics.
  var WASM_PANIC_REGISTRY: WasmPanicRegistry
}
