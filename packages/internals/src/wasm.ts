import prismaSchemaWasm from '@prisma/prisma-schema-wasm'

import { WasmPanicRegistry } from './WasmPanicRegistry'

// Note: using `import { dependencies } from '../package.json'` here would break esbuild with seemingly unrelated errors.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dependencies } = require('../package.json')

export { prismaSchemaWasm }
// e.g. 4.3.0-18.a39215673171b87177b86233206a5d65f2558857
export const prismaSchemaWasmVersion: string = dependencies['@prisma/prisma-schema-wasm']

/**
 * Set up a global registry for Wasm panics.
 * This allows us to retrieve the panic message from the Wasm panic hook,
 * which is not possible otherwise.
 */
globalThis.PRISMA_WASM_PANIC_REGISTRY = new WasmPanicRegistry()
