import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    // TODO: re-enable wrangler when https://github.com/cloudflare/workers-sdk/issues/3631 is fixed
    // const wrangler = $`pnpm wrangler dev`.nothrow()

    // let data = ''
    // for await (const chunk of wrangler.stdout) {
    //   data += chunk
    //   if (data.includes('http://127.0.0.1:8787')) {
    //     break
    //   }
    // }

    await $`pnpm exec jest`

    // await wrangler.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
