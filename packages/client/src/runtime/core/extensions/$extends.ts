import { Client } from '../../getPrismaClient'
import {
  applyModelsAndClientExtensions,
  unApplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
import { ExtensionArgs } from '../types/exported'

/**
 * @param this
 */
export function $extends(this: Client, extension: ExtensionArgs | ((client: Client) => Client)): Client {
  if (typeof extension === 'function') {
    return extension(this)
  }

  // re-apply models to the extend client: they always capture specific instance
  // of the client and without re-application they would not see new extensions
  const oldClient = unApplyModelsAndClientExtensions(this)
  const newClient = Object.create(oldClient, {
    _extensions: {
      value: this._extensions.append(extension),
    },
    _appliedParent: { value: this, configurable: true },
    $use: { value: undefined },
    $on: { value: undefined },
  }) as Client

  return applyModelsAndClientExtensions(newClient)
}
