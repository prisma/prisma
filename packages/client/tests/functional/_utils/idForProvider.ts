import { Providers } from './providers'

export interface Options {
  includeDefault: boolean
}

export function idForProvider(provider: Providers, options: Options = { includeDefault: true }): string {
  const strs = ['String @id']

  switch (provider) {
    case Providers.MONGODB:
      if (options.includeDefault) {
        strs.push('@default(auto())')
      }

      strs.push('@map("_id") @db.ObjectId')

      break

    default:
      if (options.includeDefault) {
        strs.push('@default(cuid())')
      }

      break
  }

  return strs.join(' ')
}

export function foreignKeyForProvider(provider: Providers): string {
  const strs = ['String']

  if (provider === Providers.MONGODB) {
    strs.push('@db.ObjectId')
  }

  return strs.join(' ')
}
