import type { BuildOptions } from 'esbuild'
import { build } from '../../../helpers/compile/build'

// we define the config for generator
const generatorBuildConfig: BuildOptions = {
  entryPoints: ['src/generation/generator.ts'],
  outfile: 'generator-build/index',
  bundle: true,
  external: ['_http_common', 'spdx-license-ids', 'spdx-exceptions'],
}

// we define the config for runtime
const runtimeBuildConfig: BuildOptions = {
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/index',
  bundle: true,
  external: ['_http_common', 'spdx-license-ids', 'spdx-exceptions'],
}

// we define the config for browser
const browserBuildConfig: BuildOptions = {
  entryPoints: ['src/runtime/index-browser.ts'],
  outfile: 'runtime/index',
  target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
  bundle: true,
  external: ['_http_common', 'spdx-license-ids', 'spdx-exceptions'],
}

build([generatorBuildConfig, runtimeBuildConfig, browserBuildConfig])
