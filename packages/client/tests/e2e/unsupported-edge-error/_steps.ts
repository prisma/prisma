import { createInterface } from 'node:readline/promises'
import timers from 'node:timers/promises'

import type { ProcessPromise } from 'zx'
import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wranglerProcess = $`pnpm wrangler dev --ip 127.0.0.1 --port 8787`.nothrow()

    try {
      await waitForWranglerReady(wranglerProcess)

      await timers.setTimeout(1000)

      await $`pnpm exec jest`
    } finally {
      await stopProcess(wranglerProcess).catch(() => {})
    }
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
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
