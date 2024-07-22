import { build } from '../../../helpers/compile/build'
import { esmSplitCodeToCjs } from '../../../helpers/compile/plugins/esmSplitCodeToCjs'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    splitting: true,
    external: ['@prisma/prisma-schema-wasm'],
    format: 'esm',
    plugins: [esmSplitCodeToCjs],
  },
])
