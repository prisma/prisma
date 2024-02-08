// additional tests to complement the original debug tests
beforeEach(() => {
  jest.resetModules()
  delete process.env.DEBUG
  delete process.env.DEBUG_COLORS
  // @ts-ignore
  delete globalThis.DEBUG
  // @ts-ignore
  delete globalThis.DEBUG_COLORS
})

let Debug: typeof import('../index').default
test('with a namespace', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    const debug = Debug('test')

    debug('hello world')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test hello world"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('with colors', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test2'
    process.env.DEBUG_COLORS = 'true'
    Debug = require('../index').default
    const debug = Debug('test2')

    debug('hello world')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"[32m[1mtest2[22m[39m hello world"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:*:*:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards and filter', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:*:query-engine:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test3:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with trailing wild cards', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:*:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test3:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls[2][0]).toMatchInlineSnapshot(`"test3:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(3)

    consoleLogMock.mockRestore()
  })
})

test('with trailing wild cards and filter', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:client:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test3:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards and exclusion filter', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:*:*,-test3:*:*:init'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test3:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards and multiple exclusion filters', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:*:*,-test3:*:*:init,-test3:pool:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('truncation when no wildcard is used', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client:query-engine:init')('match1')
    Debug('test3:client:query-engine')('match2')
    Debug('test3:pool:query-engine:delete')('match3')
    Debug('test3:client')('match4')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client match4"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('object serialization', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client')({ a: 1, b: { c: {} } })

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`
      "test3:client {
        "a": 1,
        "b": {
          "c": {}
        }
      }"
    `)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('millisecond timestamps', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'log').mockImplementation()

    process.env.DEBUG = 'test3:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test3:client')('match1')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test3:client match1"`)
    expect(consoleLogMock.mock.calls[0][1].match(/\+\d+ms/)).toBeTruthy()
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})
