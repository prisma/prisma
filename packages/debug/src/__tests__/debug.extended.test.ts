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
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

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
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test2'
    process.env.FORCE_COLOR = 'true'
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
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

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
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test4:*:query-engine:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test4:client:query-engine:init')('match1')
    Debug('test4:client:query-engine')('match2')
    Debug('test4:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test4:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test4:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with trailing wild cards', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test5:*:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test5:client:query-engine:init')('match1')
    Debug('test5:client:query-engine')('match2')
    Debug('test5:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test5:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test5:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls[2][0]).toMatchInlineSnapshot(`"test5:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(3)

    consoleLogMock.mockRestore()
  })
})

test('with trailing wild cards and filter', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test6:client:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test6:client:query-engine:init')('match1')
    Debug('test6:client:query-engine')('match2')
    Debug('test6:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test6:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test6:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards and exclusion filter', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test7:*:*,-test7:*:*:init'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test7:client:query-engine:init')('match1')
    Debug('test7:client:query-engine')('match2')
    Debug('test7:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test7:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test7:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})

test('with multiple wild cards and multiple exclusion filters', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test8:*:*,-test8:*:*:init,-test8:pool:*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test8:client:query-engine:init')('match1')
    Debug('test8:client:query-engine')('match2')
    Debug('test8:pool:query-engine:delete')('match3')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test8:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('truncation when no wildcard is used', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test9:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test9:client:query-engine:init')('match1')
    Debug('test9:client:query-engine')('match2')
    Debug('test9:pool:query-engine:delete')('match3')
    Debug('test9:client')('match4')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test9:client match4"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('object serialization', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test10:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test10:client')({ a: 1, b: { c: {} } })

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`
      "test10:client {
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
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test11:client'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test11:client')('match1')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test11:client match1"`)
    expect(consoleLogMock.mock.calls[0][1].match(/\+\d+ms/)).toBeTruthy()
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('wildcard can be used like a regex at the end', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test12:client*'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test12:client:query-engine:init')('match1')
    Debug('test12:client:query-engine')('match2')
    Debug('test12:pool:query-engine:delete')('match3')
    Debug('test12:client')('match4')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test12:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test12:client:query-engine match2"`)
    expect(consoleLogMock.mock.calls[2][0]).toMatchInlineSnapshot(`"test12:client match4"`)
    expect(consoleLogMock.mock.calls.length).toBe(3)

    consoleLogMock.mockRestore()
  })
})

test('wildcard can be used like a regex in the middle', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test13:client*init'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test13:client:query-engine:init')('match1')
    Debug('test13:client:query-engine')('match2')
    Debug('test13:pool:query-engine:delete')('match3')
    Debug('test13:client')('match4')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test13:client:query-engine:init match1"`)
    expect(consoleLogMock.mock.calls.length).toBe(1)

    consoleLogMock.mockRestore()
  })
})

test('can manage complex inclusions and exclusions', () => {
  jest.isolateModules(() => {
    const consoleLogMock = jest.spyOn(console, 'warn').mockImplementation()

    process.env.DEBUG = 'test14:*:query-engine:*,-*init,*:result'
    process.env.DEBUG_COLORS = 'false'
    Debug = require('../index').default
    Debug('test14:client:query-engine:init')('match1')
    Debug('test14:client:query-engine')('match2')
    Debug('test14:pool:query-engine:delete')('match3')
    Debug('test14:client')('match4')
    Debug('test14:pool:query-engine:init')('match5')
    Debug('test14:psl:init')('match6')
    Debug('test14:psl:result')('match6')

    expect(consoleLogMock.mock.calls[0][0]).toMatchInlineSnapshot(`"test14:pool:query-engine:delete match3"`)
    expect(consoleLogMock.mock.calls[1][0]).toMatchInlineSnapshot(`"test14:psl:result match6"`)
    expect(consoleLogMock.mock.calls.length).toBe(2)

    consoleLogMock.mockRestore()
  })
})
