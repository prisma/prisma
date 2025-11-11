import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
    await $`pnpm prisma db push --force-reset`
    await $`pnpm tsup src/test.ts --format esm`
  },
  test: async () => {
    await $`pnpm exec prisma -v`
    await $`node dist/test.js`
    await $`pnpm exec tsc --noEmit`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
