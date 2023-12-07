import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'

// we define the config for postinstall
const postinstallBuildConfig: BuildOptions = {
  name: 'postinstall',
  entryPoints: ['src/scripts/postinstall.ts'],
  outfile: 'dist/scripts/postinstall',
  bundle: true,
  emitTypes: false,
}

// we define the config for localinstall
const localinstallBuildConfig: BuildOptions = {
  name: 'localinstall',
  entryPoints: ['src/scripts/localinstall.ts'],
  outfile: 'dist/scripts/localinstall',
  bundle: true,
  emitTypes: false,
}

// we define the config for the default
const defaultBuildConfig: BuildOptions = {
  name: 'default',
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index',
  bundle: true,
}

void build([postinstallBuildConfig, localinstallBuildConfig, defaultBuildConfig])
