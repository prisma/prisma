import { build } from '../../../helpers/compile/build'
import { adapterConfig } from '../../../helpers/compile/configs'

const defaultBuildOptions = adapterConfig.map((opts) => ({
  ...opts,
  entryPoints: ['src/index-node.ts'],
  outfile: 'dist/index-node',
}))

const webBuildOptions = adapterConfig.map((opts) => ({
  ...opts,
  entryPoints: ['src/index-web.ts'],
  outfile: 'dist/index-web',
}))

void build([...defaultBuildOptions, ...webBuildOptions])
