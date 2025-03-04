import { request } from './request'

test('native fetch is used if it exists', async () => {
  expect.assertions(1)

  await request(
    'https://0.0.0.0',
    {
      clientVersion: '0.0.0',
      method: 'GET',
    },
    (fetch) => {
      const nodeVersion = Number.parseInt(process.versions.node.split('.')[0])

      if (nodeVersion >= 18) {
        expect(fetch).toBe(globalThis.fetch)
      } else {
        expect(fetch).not.toBe(globalThis.fetch)
      }

      return fetch
    },
  ).catch(() => {})
})
