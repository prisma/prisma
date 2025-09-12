import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate --no-engine`
  },
  test: async () => {
    await $`pnpm exec prisma -v`
    await $`ts-node src/index.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
})
