import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma generate`
  },
  test: async () => {
    await $`pnpm exec tsc --noEmit`

    // Test that Prisma finds `esbuild` + `esbuild-register` at runtime.
    await $`pnpm prisma validate --config ./src/export-config-with-prisma.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
