import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma generate --data-proxy`
  },
  test: async () => {
    await $`pnpm exec prisma -v`
    await $`ts-node src/index.ts`
    await $`pnpm exec jest`
    await $`pnpm exec tsc`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
