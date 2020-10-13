import { prompt } from 'prompts'
import { isCi } from '@prisma/sdk'
import slugify from '@sindresorhus/slugify'

type getMigratioNameOutput = {
  name?: string
  userCancelled?: string
}

export async function getMigrationName(
  name?: string,
): Promise<getMigratioNameOutput> {
  if (name) {
    return {
      name: slugify(name, { separator: '_' }),
    }
  } else if (isCi()) {
    return {
      name: '',
    }
  }

  const response = await prompt({
    type: 'text',
    name: 'name',
    message: `Name of migration`,
  })

  if (!('name' in response)) {
    return {
      userCancelled: 'Canceled by user.',
    }
  }

  return {
    name: slugify(response.name, { separator: '_' }) || '',
  }
}
