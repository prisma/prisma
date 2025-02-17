import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
  },
  test: async () => {
    await $`pnpm prisma validate --config ./src/define-config.ts`
    await $`pnpm prisma validate --config ./src/type-satisfies.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
