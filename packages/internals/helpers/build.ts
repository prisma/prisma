import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'

const internalsBuildConfig: BuildOptions = {
  name: 'default',
  plugins: [],
}

void build([internalsBuildConfig])
