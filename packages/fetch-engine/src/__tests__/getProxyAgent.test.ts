import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { getProxyAgent } from '../getProxyAgent'

const originalEnv = { ...process.env }
const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('getProxyAgent', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  test('no proxy / env vars are set - HTTP', () => {
    expect(getProxyAgent('http://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })
  test('no proxy / env vars are set - HTTPS', () => {
    expect(getProxyAgent('https://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })

  test('should not use a proxy with NO_PROXY & HTTPS_PROXY set - HTTPS', () => {
    process.env.NO_PROXY = 'example.com'
    process.env.HTTPS_PROXY = 'proxy.example.com'
    expect(getProxyAgent('https://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })

  // Lowercase env vars
  test('should warn when http_proxy is not a valid URL - HTTP', () => {
    process.env.http_proxy = 'proxy.example.com'
    expect(getProxyAgent('http://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls[0][0]).toMatchInlineSnapshot(
      `"An error occurred in getProxyAgent(), no proxy agent will be used."`,
    )
    expect(
      ctx.mocked['console.warn'].mock.calls[0][1].message.replace(' [ERR_INVALID_URL]', ''),
    ).toMatchInlineSnapshot(`
      "Error while instantiating HttpProxyAgent with URL: "proxy.example.com"
      TypeError: Invalid URL
      Check the following env vars "http_proxy" or "HTTP_PROXY". The value should be a valid URL starting with "http://""
    `)
    expect(ctx.mocked['console.warn'].mock.calls[0].length).toBe(2)
  })
  test('should warn when https_proxy is not a valid URL - HTTPS', () => {
    process.env.https_proxy = 'proxy.example.com'
    expect(getProxyAgent('https://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls[0][0]).toMatchInlineSnapshot(
      `"An error occurred in getProxyAgent(), no proxy agent will be used."`,
    )
    expect(
      ctx.mocked['console.warn'].mock.calls[0][1].message.replace(' [ERR_INVALID_URL]', ''),
    ).toMatchInlineSnapshot(`
      "Error while instantiating HttpsProxyAgent with URL: "proxy.example.com"
      TypeError: Invalid URL
      Check the following env vars "https_proxy" or "HTTPS_PROXY". The value should be a valid URL starting with "https://""
    `)
    expect(ctx.mocked['console.warn'].mock.calls[0].length).toBe(2)
  })
  // Uppercase env vars
  test('should warn when HTTP_PROXY is not a valid URL - HTTP', () => {
    process.env.HTTP_PROXY = 'proxy.example.com'
    expect(getProxyAgent('http://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls[0][0]).toMatchInlineSnapshot(
      `"An error occurred in getProxyAgent(), no proxy agent will be used."`,
    )
    expect(
      ctx.mocked['console.warn'].mock.calls[0][1].message.replace(' [ERR_INVALID_URL]', ''),
    ).toMatchInlineSnapshot(`
      "Error while instantiating HttpProxyAgent with URL: "proxy.example.com"
      TypeError: Invalid URL
      Check the following env vars "http_proxy" or "HTTP_PROXY". The value should be a valid URL starting with "http://""
    `)
    expect(ctx.mocked['console.warn'].mock.calls[0].length).toBe(2)
  })
  test('should warn when HTTPS_PROXY is not a valid URL - HTTPS', () => {
    process.env.HTTPS_PROXY = 'proxy.example.com'
    expect(getProxyAgent('https://example.com')).toBeUndefined()
    expect(ctx.mocked['console.warn'].mock.calls[0][0]).toMatchInlineSnapshot(
      `"An error occurred in getProxyAgent(), no proxy agent will be used."`,
    )
    expect(
      ctx.mocked['console.warn'].mock.calls[0][1].message.replace(' [ERR_INVALID_URL]', ''),
    ).toMatchInlineSnapshot(`
      "Error while instantiating HttpsProxyAgent with URL: "proxy.example.com"
      TypeError: Invalid URL
      Check the following env vars "https_proxy" or "HTTPS_PROXY". The value should be a valid URL starting with "https://""
    `)
    expect(ctx.mocked['console.warn'].mock.calls[0].length).toBe(2)
  })

  // Lowercase env vars
  test('should use a proxy with http_proxy set - HTTP', () => {
    process.env.http_proxy = 'http://proxy.example.com'
    expect(getProxyAgent('http://example.com')?.proxy.toString()).toEqual('http://proxy.example.com/')
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })
  test('should use a proxy with https_proxy set - HTTPS', () => {
    process.env.https_proxy = 'https://proxy.example.com'
    expect(getProxyAgent('https://example.com')?.proxy.toString()).toEqual('https://proxy.example.com/')
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })
  // Uppercase env vars
  test('should use a proxy with HTTP_PROX set - HTTP', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com'
    expect(getProxyAgent('http://example.com')?.proxy.toString()).toEqual('http://proxy.example.com/')
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })
  test('should use a proxy with HTTPS_PROXY set - HTTPS', () => {
    process.env.HTTPS_PROXY = 'https://proxy.example.com'
    expect(getProxyAgent('https://example.com')?.proxy.toString()).toEqual('https://proxy.example.com/')
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toBe('')
  })
})
