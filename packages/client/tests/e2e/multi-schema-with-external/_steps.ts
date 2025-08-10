import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
    // create test database
    await $`pnpm prisma migrate reset --force`
    // first create the external tables -> "is db empty"? checks when initializing migration table should not be triggered through this
    await $`ts-node src/init.ts`
    // create (non external) db structure
    await $`pnpm prisma migrate dev --name init`
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
