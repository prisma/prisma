import { build } from '../../../helpers/compile/build'
import { esmSplitCodeToCjs } from '../../../helpers/compile/plugins/esmSplitCodeToCjs'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    splitting: true,
    format: 'esm',
    external: ['@prisma/schema-engine-wasm'],
    plugins: [esmSplitCodeToCjs],
  },
])
