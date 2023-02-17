import prismaFmt from '@prisma/prisma-fmt-wasm'

import { WasmPanicRegistry } from './WasmPanicRegistry'

// Note: using `import { dependencies } from '../package.json'` here would break esbuild with seemingly unrelated errors.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dependencies } = require('../package.json')

export { prismaFmt }
// e.g. 4.3.0-18.a39215673171b87177b86233206a5d65f2558857
export const prismaFmtVersion: string = dependencies['@prisma/prisma-fmt-wasm']

/**
 * Set up a global registry for Wasm panics.
 * This allows us to retrieve the panic message from the Wasm panic hook,
 * which is not possible otherwise.
 */
// TODO: rename to PRISMA_WASM_PANIC_REGISTRY
globalThis.WASM_PANIC_REGISTRY = new WasmPanicRegistry()
