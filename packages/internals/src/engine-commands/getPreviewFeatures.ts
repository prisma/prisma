import { prismaSchemaWasm } from '../wasm'

export function getPreviewFeatures() {
  return JSON.parse(prismaSchemaWasm.preview_features()) as string[]
}
