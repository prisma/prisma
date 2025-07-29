import prompt from 'prompts'

import { isCi } from './isCi'
import { isInteractive } from './isInteractive'

// If not TTY or in CI we want to throw an error and not prompt.
// Because:
// Prompting when non-interactive is not possible.
// Prompting in CI would hang forever / until a timeout occurs.
// We use prompts.inject() for testing prompts in our tests.
export const canPrompt = (): boolean => {
  const injectedCount = (prompt as any)._injected?.length
  if (injectedCount) {
    // This is debug logging you can enable, but it will cause the affected test cases to fail output validation.
    // process.stdout.write(`WARNING: Prompting is enabled, because the test injected ${injectedCount} prompt item(s)\n`)
    return true
  }

  return isInteractive() && !isCi()
}
