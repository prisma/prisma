/**
 * Webpack plugin for unplugin-refract
 */

import { unpluginRefract } from './core.js'
import type { RefractPluginOptions } from './types.js'

export default unpluginRefract.webpack
export const RefractWebpackPlugin = unpluginRefract.webpack

// Class-based plugin for traditional webpack usage
export class RefractPlugin {
  constructor(private options: RefractPluginOptions = {}) {}

  apply(compiler: any) {
    const plugin = unpluginRefract.webpack(this.options)

    // Apply webpack-specific optimizations
    if (process.env.NODE_ENV === 'production' && this.options.production?.optimize !== false) {
      // Configure webpack optimization for virtual modules
      compiler.hooks.compilation.tap('RefractPlugin', (compilation: any) => {
        // Mark virtual modules as side-effect free for better tree-shaking
        compilation.hooks.buildModule.tap('RefractPlugin', (module: any) => {
          if (module.request && module.request.includes('virtual:refract/')) {
            module.factoryMeta = module.factoryMeta || {}
            module.factoryMeta.sideEffectFree = true
          }
        })
      })
    }

    return plugin.apply(compiler)
  }
}
