import { createInterface } from 'node:readline/promises'
import timers from 'node:timers/promises'

import type { ProcessPromise } from 'zx'
import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'
import { retry } from '../_utils/retry'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const { stdout } = await retry(async () => {
      const wranglerProcess = $`pnpm wrangler dev --ip 127.0.0.1 --port 8787 src/index.ts`.nothrow()

      try {
        await waitForWranglerReady(wranglerProcess)

        await timers.setTimeout(1000)

        return await $`curl http://localhost:8787/ -s`
      } finally {
        await stopProcess(wranglerProcess).catch(() => {})
      }
    }, 3)

    const expected =
      '{"Role":{"USER":"USER","ADMIN":"ADMIN"},"ModelName":{"User":"User","Post":"Post","Profile":"Profile"}}'

    if (!stdout.includes(expected)) {
      throw new Error('Expected to fetch the enum values')
    } else {
      console.log('Success!')
    }
  },
  finish: async () => {
    await $`echo "done"`
  },
})

async function waitForWranglerReady(processPromise: ProcessPromise) {
  const stdout = processPromise.stdout

  if (!stdout) {
    throw new Error('Wrangler stdout is not available; cannot detect readiness')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Timed out waiting for wrangler to report readiness'))
  }, 30_000)

  const rl = createInterface({ input: stdout, crlfDelay: Infinity })

  try {
    controller.signal.throwIfAborted()

    for await (const line of rl) {
      controller.signal.throwIfAborted()

      if (line.includes('Ready')) {
        return
      }
    }

    throw new Error('Wrangler stdout closed before reporting readiness')
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason as Error
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
    rl.close()
    stdout.resume()
  }
}

async function stopProcess(processPromise: ProcessPromise) {
  await processPromise.kill('SIGINT')
  await processPromise
}
