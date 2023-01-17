import { isCi, isInteractive } from '@prisma/internals'
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
  // If not TTY or CI, use default name
  else if ((!isInteractive || isCi()) && Boolean(prompt._injected?.length) === false) {
    return {
      name: '',
    }
  }

  const messageForPrompt = `Enter a name for the new migration:`
  // For testing purposes we log the message
  // An alternative would be to find a way to capture the prompt message from jest tests
  // (attempted without success)
  if (Boolean((prompt as any)._injected?.length) === true) {
    console.info(messageForPrompt)
  }
  const response = await prompt({
    type: 'text',
    name: 'name',
    message: messageForPrompt,
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
