/**
 * esbuild plugin for unplugin-refract
 */

import { unpluginRefract } from './core.js'
import type { RefractPluginOptions } from './types.js'

export default unpluginRefract.esbuild
export const refractEsbuildPlugin = unpluginRefract.esbuild

// Named export for explicit usage
export function defineRefractEsbuildPlugin(options: RefractPluginOptions = {}) {
  return unpluginRefract.esbuild(options)
}
