import { Client } from '../../getPrismaClient'
import {
  applyModelsAndClientExtensions,
  unApplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
import { ExtensionArgs } from '../types/exported'
import { logger } from '@prisma/internals'

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

  // Check if $on and $use are configured before extending the client
  if (this.$on !== undefined || this.$use !== undefined) {
    logger.warn("$on and $use are not available after $extends due to their global nature; they apply to all forks simultaneously. To ensure proper usage, please configure any middleware or event handlers before extending the client. For detailed guidance, refer to the documentation: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions#usage-of-on-and-use-with-extended-clients");
  }
  
  const newClient = Object.create(oldClient, {
    _extensions: {
      value: this._extensions.append(extension),
    },
    _appliedParent: { value: this, configurable: true },
  }) as Client

  return applyModelsAndClientExtensions(newClient)
}
