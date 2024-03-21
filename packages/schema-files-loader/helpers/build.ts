import { build } from '../../../helpers/compile/build'
import { esmSplitCodeToCjs } from '../../../helpers/compile/plugins/esmSplitCodeToCjs'

void build([
  {
    name: 'default',
    entryPoints: { index: 'src/schema-files-loader.ts' },
    external: ['fs-extra'],
    bundle: true,
    emitTypes: true,
    splitting: true,
    format: 'esm',
    plugins: [esmSplitCodeToCjs],
  },
])
