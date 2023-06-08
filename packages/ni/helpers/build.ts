import { BuildOptions, build } from '../../../helpers/compile/build'

const defaultBuildConfig: BuildOptions = {
  name: 'default',
  bundle: true,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index',
}

void build([defaultBuildConfig])
