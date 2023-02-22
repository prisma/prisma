import { $ } from 'zx'

/**
 * Starts the Next.js server and tests the endpoint
 * @param endpoint The endpoint to test
 */
async function test(endpoint: string) {
  await $`rm -fr .next/standalone/node_modules/next`
  const nextJsProcess = $`node .next/standalone/server.js`

  for await (const line of nextJsProcess.stdout) {
    if (line.includes('Listening on port')) break
  }

  const data = await $`curl -LI http://localhost:3000/${endpoint} -o /dev/null -w '%{http_code}' -s`

  await nextJsProcess.kill('SIGINT')

  if (data.stdout !== '200') {
    throw new Error(`Expected 200 but got ${data.stdout}`)
  }
}

export async function testServerComponents() {
  await test('test/42')
}

export async function testNonServerComponents() {
  await test('api/test')
}
