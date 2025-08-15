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
  },
  test: async () => {
    // create initial (non external) db structure
    await $`pnpm prisma migrate dev --name init`

    // import external tables and generate
    await $`pnpm prisma db pull`
    await $`pnpm prisma generate`
    await $`pnpm exec tsc --noEmit`

    // create relationship migration
    await $`cp -f prisma/schema-updated.prisma prisma/schema.prisma`
    await $`pnpm prisma migrate dev --name add-relationship`
    await $`pnpm exec tsc --noEmit`

    // check end result
    await $`pnpm exec jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
