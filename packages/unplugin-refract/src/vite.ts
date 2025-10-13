/**
 * Vite plugin for unplugin-refract
 */

import { unpluginRefract } from './core.js'
import type { RefractPluginOptions } from './types.js'

export default unpluginRefract.vite
export const refractPlugin = unpluginRefract.vite

// Named export for explicit usage
export function defineRefractPlugin(options: RefractPluginOptions = {}) {
  return unpluginRefract.vite(options)
}
