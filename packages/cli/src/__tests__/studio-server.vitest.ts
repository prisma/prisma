import { getPort } from 'get-port-please'
import { afterEach, expect, test } from 'vitest'

import { startStudioServer, type StudioServer } from '../studio-server'

const activeServers: StudioServer[] = []

afterEach(() => {
  while (activeServers.length > 0) {
    activeServers.pop()!.close()
  }
})

test('streams GET response bodies from the Node Studio server', async () => {
  const { port } = await startTestServer(() => new Response('hello from studio', { status: 200 }))

  const response = await fetch(`http://127.0.0.1:${port}/`)

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('hello from studio')
})

test('preserves HEAD semantics without dropping GET bodies', async () => {
  const { port } = await startTestServer(() => new Response('hello from studio', { status: 200 }))

  const response = await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD' })

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('')
})

async function startTestServer(handler: (request: Request) => Response | Promise<Response>): Promise<{ port: number }> {
  const port = await getPort({ host: '127.0.0.1' })

  await new Promise<void>((resolve) => {
    const server = startStudioServer({
      handler,
      onListen: resolve,
      port,
    })

    activeServers.push(server)
  })

  return { port }
}
