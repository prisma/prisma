import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
    await $`pnpm exec prisma db push --force-reset --skip-generate`
  },
  test: async () => {
    await $`ts-node src/index.ts`
    await $`pnpm exec tsc`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
