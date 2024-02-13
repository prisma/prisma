export function buildSerializedSchema(_wasm: boolean) {
  // TODO: `wasm` is false even when `PRISMA_CLIENT_FORCE_WASM=1`.
  // After fixing this, we should only import `serializedSchema` if `wasm` is true.

  return `
const { serializedSchema } = require('./schema.bin.js');
config.serializedSchema = serializedSchema;
`
}
