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
    await $`pnpm exec jest url.ts`
    await $`pnpm exec jest no-config.ts`

    // tests without an engine
    await $`pnpm prisma generate --no-engine`
    await $`pnpm exec jest no-engine.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
})
