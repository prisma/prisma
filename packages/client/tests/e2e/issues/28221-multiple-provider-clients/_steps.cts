import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    for (const provider of ['mysql', 'postgres']) {
      await $`pnpm exec prisma generate --config=./prisma/${provider}/prisma.config.ts`
      await $`pnpm exec prisma db push --force-reset --skip-generate --config=./prisma/${provider}/prisma.config.ts`
    }
  },
  test: async () => {
    await $`tsx src/index.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
