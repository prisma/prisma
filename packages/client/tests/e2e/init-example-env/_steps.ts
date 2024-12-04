import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma init --datasource-provider sqlite`
  },
  test: async () => {
    await $`ts-node src/index.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
