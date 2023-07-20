export class WasmPanicRegistry {
  private message = ''

  get() {
    return `${this.message}`
  }

  // Don't use this method directly, it's only used by the Wasm panic hook in @prisma/prisma-schema-wasm.
  private set_message(value: string) {
    this.message = `RuntimeError: ${value}`
  }
}
