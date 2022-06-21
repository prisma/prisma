import { isCi } from '@prisma/internals'
import slugify from '@sindresorhus/slugify'
import { prompt } from 'prompts'

type getMigratioNameOutput = {
  name?: string
  userCancelled?: string
}

export async function getMigrationName(name?: string): Promise<getMigratioNameOutput> {
  // Truncate if longer
  const maxMigrationNameLength = 200

  if (name) {
    return {
      name: slugify(name, { separator: '_' }).substring(0, maxMigrationNameLength),
    }
  }
  // We use prompts.inject() for testing in our CI
  else if (isCi() && Boolean(prompt._injected?.length) === false) {
    return {
      name: '',
    }
  }

  const response = await prompt({
    type: 'text',
    name: 'name',
    message: `Enter a name for the new migration:`,
  })

  if (!('name' in response)) {
    return {
      userCancelled: 'Canceled by user.',
    }
  }

  return {
    name: slugify(response.name, { separator: '_' }).substring(0, maxMigrationNameLength) || '',
  }
}
