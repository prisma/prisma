import { $ } from 'zx'

/**
 * Starts the Next.js server and tests the endpoint. It tests:
 * - No workaround + Server Components: if fails, nice error message
 * - No workaround + non-Server Components: if fails, nice error message
 * - Workaround + Server Components: should succeed
 * - Workaround + non-Server Components: should succeed
 * @param endpoint the endpoint to test
 * @param serverComponents whether we use server components or not
 */
async function test(endpoint: string, serverComponents: boolean) {
  console.log(`Testing ${endpoint} with WORKAROUND=${process.env.WORKAROUND}`)

  // prepare and start the next.js server
  const nextJsBuild = await $`pnpm exec next build`.nothrow()
  await $`rm -fr .next/standalone/node_modules/next`.nothrow()
  const nextJsProcess = $`node .next/standalone/server.js`.nothrow()

  // wait for the server to be fully ready
  for await (const line of nextJsProcess.stdout) {
    if (line.includes('Listening on port')) break
  }

  // attempt to query the endpoint with curl
  const data = await $`curl -LI http://localhost:3000/${endpoint} -o /dev/null -w '%{http_code}' -s`.nothrow()

  // kill and proceed with test assertions
  await nextJsProcess.kill('SIGINT')

  // Path 1: No workaround + a nice error message
  if (process.env.WORKAROUND !== 'true' && (data.stdout === '500' || nextJsBuild.exitCode !== 0)) {
    // Dual logic: server components error at build & runtime, non-Server components at runtime
    // this is also why we use `.nothrow()` and only check for exit codes as well as http codes
    const stderr = (await nextJsProcess).stderr + nextJsBuild.stderr // dual logic
    const message = `PrismaClientInitializationError: Your schema.prisma could not be found, and we detected that you are using Next.js.
Find out why and learn how to fix this: https://pris.ly/d/schema-not-found-nextjs
    at`

    if (stderr.includes(message) === false) {
      throw new Error(`Expected an error message starting with "${message}" but got "${stderr}"`)
    }

    return
  }

  // Path 2: Workaround + no error message
  if (process.env.WORKAROUND === 'true' && data.stdout === '200') {
    return
  }

  // Path 3: Otherwise, it should succeed
  if (data.stdout !== '200') {
    throw new Error(`Expected 200 but got ${data.stdout}`)
  }
}

export async function testServerComponents() {
  process.env.WORKAROUND = 'true'
  await test('test/42', true)
  process.env.WORKAROUND = 'false'
  await test('test/42', true)
}

export async function testNonServerComponents() {
  process.env.WORKAROUND = 'true'
  await test('api/test', false)
  process.env.WORKAROUND = 'false'
  await test('api/test', false)
}
