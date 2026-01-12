/**
 * Webpack plugin for unplugin-ork
 */

import { unpluginOrk } from './core.js'
import type { OrkPluginOptions } from './types.js'

export default unpluginOrk.webpack
export const OrkWebpackPlugin = unpluginOrk.webpack

// Class-based plugin for traditional webpack usage
export class OrkPlugin {
  constructor(private options: OrkPluginOptions = {}) {}

  apply(compiler: any) {
    const plugin = unpluginOrk.webpack(this.options)

    // Apply webpack-specific optimizations
    if (process.env.NODE_ENV === 'production' && this.options.production?.optimize !== false) {
      // Configure webpack optimization for virtual modules
      compiler.hooks.compilation.tap('OrkPlugin', (compilation: any) => {
        // Mark virtual modules as side-effect free for better tree-shaking
        compilation.hooks.buildModule.tap('OrkPlugin', (module: any) => {
          if (module.request && module.request.includes('virtual:ork/')) {
            module.factoryMeta = module.factoryMeta || {}
            module.factoryMeta.sideEffectFree = true
          }
        })
      })
    }

    return plugin.apply(compiler)
  }
}
