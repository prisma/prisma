import { $, cd, ProcessPromise } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

let nextJsProcess: ProcessPromise
void executeSteps({
  setup: async () => {
    await $`pnpm install`
    cd('packages/service')
    await $`pnpm exec prisma db push --force-reset`
    await $`pnpm exec next build`
  },
  test: async () => {
    await $`rm -fr .next/standalone/node_modules/next`
    nextJsProcess = $`node .next/standalone/server.js`
    await $`sleep 5`
    const data = await $`curl -LI http://localhost:3000/test/42 -o /dev/null -w '%{http_code}\\n' -s`
    if (data.stdout !== '200\n') {
      throw new Error(`Expected 200 but got ${data.stdout}`)
    }
  },
  finish: async () => {
    await nextJsProcess.kill('SIGINT')

    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})
