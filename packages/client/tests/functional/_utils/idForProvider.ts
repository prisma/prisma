export interface IOptions {
  includeDefault: boolean
}

export function idForProvider(provider: string, options: IOptions = { includeDefault: true }): string {
  const strs: string[] = ['String @id']

  switch (provider) {
    case 'mongodb':
      if (options.includeDefault) {
        strs.push('@default(auto())')
      }

      strs.push('@map("_id") @db.ObjectId')

      break
    default:
      if (options.includeDefault) {
        strs.push('@default(uuid())')
      }

      break
  }

  return strs.join(' ')
}
