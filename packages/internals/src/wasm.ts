import _prismaFmt from '@prisma/prisma-fmt-wasm'

// Note: using `import { dependencies } from '../package.json'` here would break esbuild with seemingly unrelated errors.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dependencies } = require('../package.json')

export const prismaFmt = _prismaFmt
// e.g. 4.3.0-18.a39215673171b87177b86233206a5d65f2558857
export const prismaFmtVersion: string = dependencies['@prisma/prisma-fmt-wasm']
