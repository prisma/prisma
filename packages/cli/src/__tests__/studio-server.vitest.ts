import { getPort } from 'get-port-please'
import { afterEach, expect, test, vi } from 'vitest'

import { startStudioServer, type StudioServer } from '../studio-server'

const activeServers: StudioServer[] = []

afterEach(() => {
  vi.restoreAllMocks()

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

test('logs server errors and returns the error message in the response body', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const error = new Error('boom')
  const { port } = await startTestServer(() => {
    throw error
  })

  const response = await fetch(`http://127.0.0.1:${port}/`)

  expect(response.status).toBe(500)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(await response.text()).toBe('boom')
  expect(consoleErrorSpy).toHaveBeenCalledWith('[Prisma Studio]', error)
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
