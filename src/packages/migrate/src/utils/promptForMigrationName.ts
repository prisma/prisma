import { prompt } from 'prompts'
import { isCi } from '@prisma/sdk'

type getMigratioNameOutput = {
  name?: string
  userCancelled?: string
}

export async function getMigrationName(
  name?: string,
): Promise<getMigratioNameOutput> {
  if (name) {
    return {
      name,
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
    name: response.name || '',
  }
}
