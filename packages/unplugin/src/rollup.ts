/**
 * Rollup plugin for unplugin-ork
 */

import { unpluginOrk } from './core.js'
import type { OrkPluginOptions } from './types.js'

export default unpluginOrk.rollup
export const orkRollupPlugin = unpluginOrk.rollup

// Named export for explicit usage
export function defineOrkRollupPlugin(options: OrkPluginOptions = {}) {
  return unpluginOrk.rollup(options)
}
