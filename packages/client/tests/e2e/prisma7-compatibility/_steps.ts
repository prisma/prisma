import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec tsc --noEmit`
    await $`pnpm exec prisma7 --version`
    await $`pnpm exec prisma7 generate`
  },
  test: async () => {
    await $`pnpm exec tsc --noEmit --module node16 --moduleResolution node16 --target es2022 smoke.ts`
    await $`tsx smoke.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
})
