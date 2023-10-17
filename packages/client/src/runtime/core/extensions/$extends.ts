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

// Checks $on and $use availability after client extension
function checkOnAndUseAvailability(client: Client) {
  if (client.$on !== undefined || client.$use !== undefined) {
    return () => {
      //throw new Error("$on and $use are not available after $extends due to their global nature; they apply to all forks simultaneously. To ensure proper usage, please configure any middleware or event handlers before extending the client. For detailed guidance, refer to the documentation: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions#usage-of-on-and-use-with-extended-clients");
      logger.warn("$on and $use are not available after $extends due to their global nature; they apply to all forks simultaneously. To ensure proper usage, please configure any middleware or event handlers before extending the client. For detailed guidance, refer to the documentation: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions#usage-of-on-and-use-with-extended-clients");
    };
  }
  return;
}

export function $extends(this: Client, extension: ExtensionArgs | ((client: Client) => Client)): Client {
  if (typeof extension === 'function') {
    return extension(this)
  }

  // re-apply models to the extend client: they always capture specific instance
  // of the client and without re-application they would not see new extensions
  const oldClient = unApplyModelsAndClientExtensions(this)

  checkOnAndUseAvailability(this);

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