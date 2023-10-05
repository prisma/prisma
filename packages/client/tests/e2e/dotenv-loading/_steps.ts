import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
    // await $`pnpm exec prisma db push --force-reset --skip-generate`
  },
  test: async () => {
    // await $`pnpm exec prisma -v`
    // await $`ts-node src/index.ts`
    // await $`pnpm exec tsc --noEmit`
    console.debug('process.env.TEST_ENV_VAR sdjhfsd,ghsdfh', process.env.TEST_ENV_VAR)
    await $`pnpm exec jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
