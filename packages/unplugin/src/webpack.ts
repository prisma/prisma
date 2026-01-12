/**
 * Webpack plugin for unplugin-ork
 */

import type { Compilation, Compiler, Module } from 'webpack'

import { unpluginOrk } from './core.js'
import type { OrkPluginOptions } from './types.js'

export default unpluginOrk.webpack
export const OrkWebpackPlugin = unpluginOrk.webpack

// Class-based plugin for traditional webpack usage
export class OrkPlugin {
  constructor(private options: OrkPluginOptions = {}) {}

  apply(compiler: Compiler) {
    const plugin = unpluginOrk.webpack(this.options)

    // Apply webpack-specific optimizations
    if (process.env.NODE_ENV === 'production' && this.options.production?.optimize !== false) {
      // Configure webpack optimization for virtual modules
      compiler.hooks.compilation.tap('OrkPlugin', (compilation: Compilation) => {
        // Mark virtual modules as side-effect free for better tree-shaking
        compilation.hooks.buildModule.tap('OrkPlugin', (module: Module) => {
          const request = getModuleRequest(module)
          if (request?.includes('virtual:ork/')) {
            module.factoryMeta = module.factoryMeta || {}
            module.factoryMeta.sideEffectFree = true
          }
        })
      })
    }

    return plugin.apply(compiler)
  }
}

type ModuleWithRequest = Module & { request?: unknown }

function getModuleRequest(module: Module): string | null {
  const request = (module as ModuleWithRequest).request
  return typeof request === 'string' ? request : null
}
