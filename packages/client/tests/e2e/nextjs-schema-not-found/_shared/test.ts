import { $ } from 'zx'

/**
 * Starts the Next.js server and tests the endpoint
 * @param endpoint The endpoint to test
 */
async function test(endpoint: string) {
  console.log(`Testing ${endpoint} with WORKAROUND=${process.env.WORKAROUND}`)

  // prepare and start the next.js server
  await $`pnpm exec next build`
  await $`rm -fr .next/standalone/node_modules/next`
  const nextJsProcess = $`node .next/standalone/server.js`

  // wait for the server to be fully ready
  for await (const line of nextJsProcess.stdout) {
    if (line.includes('Listening on port')) break
  }

  // attempt to query the endpoint with curl
  const data = await $`curl -LI http://localhost:3000/${endpoint} -o /dev/null -w '%{http_code}' -s`

  // kill and proceed with test assertions
  await nextJsProcess.kill('SIGINT')

  // Path 1: No workaround + a nice error message
  if (process.env.WORKAROUND !== 'true' && data.stdout === '500') {
    const stderr = (await nextJsProcess).stderr
    const message = `PrismaClientInitializationError: Your schema.prisma could not be found, and we detected that you are using Next.js.
Find out why and learn how to fix this: https://pris.ly/d/schema-not-found-nextjs
    at`

    if (stderr.startsWith(message) === false) {
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
  await test('test/42')
  process.env.WORKAROUND = 'false'
  await test('test/42')
}

export async function testNonServerComponents() {
  process.env.WORKAROUND = 'true'
  await test('api/test')
  process.env.WORKAROUND = 'false'
  await test('api/test')
}
