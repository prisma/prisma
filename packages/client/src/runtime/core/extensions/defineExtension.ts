import type { Client } from '../../getPrismaClient'
import type { ExtensionArgs } from '../types/exported/ExtensionArgs'

export function defineExtension(ext: ExtensionArgs | ((client: Client) => Client)) {
  if (typeof ext === 'function') {
    return ext
  }

  return (client: Client) => client.$extends(ext)
}
