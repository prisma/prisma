import type { Client } from '../../getPrismaClient'
import type { AccelerateEngine } from '../engines/accelerate/AccelerateEngine'
import { applyModelsAndClientExtensions } from '../model/applyModelsAndClientExtensions'
import type { ExtensionArgs } from '../types/exported'

/**
 * @param this
 */
export function $extends(this: Client, extension: ExtensionArgs | ((client: Client) => Client)): Client {
  if (typeof extension === 'function') {
    return extension(this)
  }

  if (extension.client?.__AccelerateEngine) {
    const Engine = extension.client.__AccelerateEngine as typeof AccelerateEngine
    this._originalClient._engine = new Engine(this._originalClient._accelerateEngineConfig)
  }

  const newClient = Object.create(this._originalClient, {
    _extensions: { value: this._extensions.append(extension) },
    _appliedParent: { value: this, configurable: true },
    $use: { value: undefined },
    $on: { value: undefined },
  }) as Client

  return applyModelsAndClientExtensions(newClient)
}
