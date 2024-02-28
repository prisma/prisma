import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    await $`pnpm esbuild src/new-client.ts --bundle --minify --target=chrome58 --outfile=dist/new-client.js --format=cjs`
    await $`pnpm esbuild src/enum-import.ts --bundle --minify --target=chrome58 --outfile=dist/enum-import.js --format=cjs`
    await $`pnpm jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
