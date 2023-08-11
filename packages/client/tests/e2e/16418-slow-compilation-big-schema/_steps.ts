import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = 'true'
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const timeBefore = Date.now()
    await $`pnpm exec tsc`
    const timeAfter = Date.now()

    const timeDiff = timeAfter - timeBefore
    console.log(`timeDiff: ${timeDiff}`)

    if (timeDiff > 1000 * 60) {
      throw new Error('Compilation took more than 1 minute')
    }
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
