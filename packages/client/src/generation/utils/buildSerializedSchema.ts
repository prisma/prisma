export function buildSerializedSchema(wasm: boolean) {
  if (wasm) {
    return `
const { serializedSchema } = require('./schema.bin.js');
config.serializedSchema = serializedSchema;
`
  }

  return ''
}
