import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install --dangerously-allow-all-builds`
    await $`pnpm exec prisma db push --force-reset --skip-generate`
    await $`pnpm prisma generate --sql`
  },
  test: async () => {
    await $`ts-node src/index.ts`
    await $`pnpm exec tsc --noEmit`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
