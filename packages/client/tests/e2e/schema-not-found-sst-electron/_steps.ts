import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
  },
  test: async () => {
    await $`pnpm exec esbuild src/index.ts --bundle --outdir=dist --platform=node`
    await $`mv generated/client dist/client`
    await $`pnpm exec jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
})
