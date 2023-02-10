import prompt from 'prompts'

import { isCi } from './isCi'
import { isInteractive } from './isInteractive'

// If not TTY or in CI we want to throw an error and not prompt.
// Because:
// Prompting when non interactive is not possible.
// Prompting in CI would hang forever / until a timeout occurs.
export const canPrompt = (): boolean => {
  // Note: We use prompts.inject() for testing prompts in our CI
  return Boolean((prompt as any)._injected?.length) || (isInteractive() && !isCi())
}
