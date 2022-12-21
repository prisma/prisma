import { Client } from '../../getPrismaClient'
import { Args } from './$extends'

export function defineExtension(ext: Args | ((client: Client) => Client)) {
  if (typeof ext === 'function') {
    return ext
  }

  return (client: Client) => client.$extends(ext)
}
