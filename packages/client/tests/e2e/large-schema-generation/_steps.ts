import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`tsx src/generate-schema.ts`
  },
  test: async () => {
    await $`pnpm prisma generate`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // Uncomment to keep the test environment for debugging
})
