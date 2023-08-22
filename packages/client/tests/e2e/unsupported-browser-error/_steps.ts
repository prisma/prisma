import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    await $`pnpm esbuild src/index.ts --bundle --minify --target=chrome58 --outfile=dist/index.js --format=cjs`
    await $`pnpm jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
