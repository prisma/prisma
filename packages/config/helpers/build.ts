import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: false,
    external: ['esbuild', 'esbuild-register'],
  },
])
