export interface Options {
  includeDefault: boolean
}

export function idForProvider(provider: string, options: Options = { includeDefault: true }): string {
  const strs = ['String @id']

  switch (provider) {
    case 'mongodb':
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

export function idForProviderType(provider: string) {
  switch (provider) {
    case 'mongodb':
      return 'String @db.ObjectId'

    default:
      return 'String'
  }
}
