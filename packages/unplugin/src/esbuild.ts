/**
 * esbuild plugin for unplugin-ork
 */

import { unpluginOrk } from './core.js'
import type { OrkPluginOptions } from './types.js'

export default unpluginOrk.esbuild
export const orkEsbuildPlugin = unpluginOrk.esbuild

// Named export for explicit usage
export function defineOrkEsbuildPlugin(options: OrkPluginOptions = {}) {
  return unpluginOrk.esbuild(options)
}
