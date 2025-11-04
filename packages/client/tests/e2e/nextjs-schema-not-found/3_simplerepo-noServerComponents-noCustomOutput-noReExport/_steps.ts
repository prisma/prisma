import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'
// import { testNonServerComponents } from '../_shared/test'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
  },
  test: async () => {
    // TODO: this fails with:
    // `ENOENT: no such file or directory, open '[..]node_modules/.prisma/client/query_compiler_bg.wasm'`.
    // await testNonServerComponents({ monorepo: false })
  },
  finish: async () => {},
})
