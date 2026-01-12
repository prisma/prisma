/**
 * Vite plugin for unplugin-ork
 */

import { unpluginOrk } from './core.js'
import type { OrkPluginOptions } from './types.js'

export default unpluginOrk.vite
export const orkPlugin = unpluginOrk.vite

// Named export for explicit usage
export function defineOrkPlugin(options: OrkPluginOptions = {}) {
  return unpluginOrk.vite(options)
}
