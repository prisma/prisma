import { prompt } from 'prompts'
import { isCi } from '@prisma/sdk'

export async function getMigrationName(name?: string): Promise<string> {
  if (name) {
    return name
  } else if (isCI()) {
    return ''
  }

  const response = await prompt({
    type: 'text',
    name: 'name',
    message: `Name of migration`,
  })
  return response.name || ''
}
