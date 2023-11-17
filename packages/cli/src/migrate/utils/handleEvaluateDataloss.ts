import { getCommandWithExecutor } from '@prisma/internals'
import { bold, red } from 'kleur/colors'

import type { MigrationFeedback } from '../types'

export function handleUnexecutableSteps(unexecutableSteps: MigrationFeedback[], createOnly = false) {
  if (unexecutableSteps && unexecutableSteps.length > 0) {
    const messages: string[] = []
    messages.push(`${bold(red('\n⚠️ We found changes that cannot be executed:\n'))}`)
    for (const item of unexecutableSteps) {
      messages.push(`${`  • Step ${item.stepIndex} ${item.message}`}`)
    }
    console.info() // empty line

    // If create only, allow to continue
    if (createOnly) {
      console.error(`${messages.join('\n')}\n`)
      return undefined
    } else {
      return `${messages.join('\n')}

You can use ${getCommandWithExecutor(
        'prisma migrate dev --create-only',
      )} to create the migration file, and manually modify it to address the underlying issue(s).
Then run ${getCommandWithExecutor('prisma migrate dev')} to apply it and verify it works.\n`
    }
  }

  return undefined
}
