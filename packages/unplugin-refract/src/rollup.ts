/**
 * Rollup plugin for unplugin-refract
 */

import { unpluginRefract } from './core.js'
import type { RefractPluginOptions } from './types.js'

export default unpluginRefract.rollup
export const refractRollupPlugin = unpluginRefract.rollup

// Named export for explicit usage
export function defineRefractRollupPlugin(options: RefractPluginOptions = {}) {
  return unpluginRefract.rollup(options)
}
