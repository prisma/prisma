import prismaSchemaWasm from '@prisma/prisma-schema-wasm'
import { SchemaEngine as SchemaEngineWasm, version as getSchemaEngineWasmVersion } from '@prisma/schema-engine-wasm'

import { WasmPanicRegistry } from './WasmPanicRegistry'

/**
 * Set up a global registry for Wasm panics.
 * This allows us to retrieve the panic message from the Wasm panic hook,
 * which is not possible otherwise.
 */
globalThis.PRISMA_WASM_PANIC_REGISTRY = new WasmPanicRegistry()

// Note: using `import { dependencies } from '../package.json'` here would break esbuild with seemingly unrelated errors.

const { dependencies } = require('../package.json')

export { prismaSchemaWasm, SchemaEngineWasm }

// e.g. 6.6.0-34.cd2dc4cb0f2f888a21fd4de05f7d1175433e901d
export const prismaSchemaWasmVersion: string = dependencies['@prisma/prisma-schema-wasm']
export const schemaEngineWasmVersion: string = getSchemaEngineWasmVersion()
