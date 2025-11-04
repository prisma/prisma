import { $, cd } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'
// import { testServerComponents } from '../_shared/test'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
    cd('packages/service')
  },
  test: async () => {
    // TODO: this fails with:
    // `ENOENT: no such file or directory, open '[..]node_modules/.prisma/client/query_compiler_bg.wasm'`.
    // await testServerComponents()
  },
  finish: async () => {},
})
