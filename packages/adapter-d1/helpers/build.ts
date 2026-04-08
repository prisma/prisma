import { build } from '../../../helpers/compile/build'
import { createAdapterConfig } from '../../../helpers/compile/configs'

const bundleConfig = createAdapterConfig([
  { entry: 'src/index-node.ts', outfile: 'dist/index-node' },
  { entry: 'src/index-workerd.ts', outfile: 'dist/index-workerd' },
])

void build(bundleConfig)
