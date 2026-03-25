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
  const port = await getAvailablePort()

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

async function getAvailablePort(): Promise<number> {
  const probe = await import('node:net').then(({ createServer }) => createServer())

  return await new Promise<number>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to allocate a test port for the Studio server.'))
        return
      }

      const { port } = address
      probe.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}
