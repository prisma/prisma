import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
  },
  test: async () => {
    // tests with an engine
    await $`pnpm prisma generate`
    await $`pnpm exec jest edge.ts`
    await $`pnpm exec jest nodejs.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
})
