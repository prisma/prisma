import prismaSchemaWasm from '@prisma/prisma-schema-wasm'
import type { SchemaEngine as SchemaEngineWasm } from '@prisma/schema-engine-wasm'

import { WasmPanicRegistry } from './WasmPanicRegistry'

type GlobalWithPanicRegistry = typeof globalThis & {
  PRISMA_WASM_PANIC_REGISTRY: WasmPanicRegistry
}

const globalWithPanicRegistry = globalThis as GlobalWithPanicRegistry

/**
 * Set up a global registry for Wasm panics.
 * This allows us to retrieve the panic message from the Wasm panic hook,
 * which is not possible otherwise.
 */
globalWithPanicRegistry.PRISMA_WASM_PANIC_REGISTRY = new WasmPanicRegistry()

// Note: using `import { dependencies } from '../package.json'` here would break esbuild with seemingly unrelated errors.

const { dependencies } = require('../package.json')

export { prismaSchemaWasm, SchemaEngineWasm }

// e.g. 4.3.0-18.a39215673171b87177b86233206a5d65f2558857
export const prismaSchemaWasmVersion: string = dependencies['@prisma/prisma-schema-wasm']
export const schemaEngineWasmVersion: string = dependencies['@prisma/schema-engine-wasm']
