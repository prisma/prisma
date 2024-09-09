import http from 'node:http'

import { $ } from 'zx'

export const MONOREPO_APP_DIR_SERVER = '.next/standalone/packages/service/server.js'
export const DEFAULT_SERVER = '.next/standalone/server.js'

/**
 * Starts the Next.js server and tests the endpoint. It tests:
 * - No workaround + Server Components: if fails, nice error message
 * - No workaround + non-Server Components: if fails, nice error message
 * - Workaround + Server Components: should succeed
 * - Workaround + non-Server Components: should succeed
 * @param endpoint the endpoint to test
 */
async function test({ endpoint, server = DEFAULT_SERVER }: { endpoint: string; server?: string }) {
  console.log(`Testing ${endpoint}`)

  // prepare and start the next.js server
  await $`pnpm exec next build`
  await $`rm -fr .next/standalone/node_modules/next`.nothrow()
  const nextJsProcess = $`HOSTNAME=127.0.0.1 node ${server}`.nothrow()

  // wait for the server to be fully ready
  for await (const line of nextJsProcess.stdout) {
    if (line.includes('Ready in')) break
  }

  // attempt to query the endpoint with curl
  const code = await getHttpCode(endpoint)

  // kill and proceed with test assertions
  await nextJsProcess.kill('SIGINT')

  if (code !== 200) {
    throw new Error(`Expected 200 but got ${code}`)
  }
}

export async function getHttpCode(endpoint: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    http
      .get(new URL(endpoint, 'http://localhost:3000'), (res) => {
        res.resume() // consume body
        res.on('end', () => resolve(res.statusCode))
      })
      .on('error', (error) => reject(error))
  })
}

type TestOptions = {
  monorepo?: boolean
}

export function testServerComponents(options?: TestOptions) {
  return testEndpoint('test/42', options)
}

export async function testNonServerComponents(options?: TestOptions) {
  return testEndpoint('api/test', options)
}

async function testEndpoint(endpoint, { monorepo = true }: TestOptions = {}) {
  const server = monorepo ? MONOREPO_APP_DIR_SERVER : DEFAULT_SERVER
  await test({ endpoint, server })
}
