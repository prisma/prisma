import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = undefined
    await $`pnpm install`
  },
  test: async () => {
    await $`pnpm exec tsc --noEmit`
    await $`pnpm exec jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
