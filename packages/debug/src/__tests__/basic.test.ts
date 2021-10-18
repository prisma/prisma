import Debug, { getLogs } from '..'
import stripAnsi from 'strip-ansi'
import { removeISODate, sanitizeTestLogs } from '../util'

describe('debug', () => {
  test('shouldnt log if its not enabled', () => {
    const debug = Debug('my-namespace')
    const logs: string[] = []
    debug.log = (...args) => {
      logs.push(stripAnsi(args[0]).trimStart())
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(removeISODate(JSON.stringify(logs, null, 2))).toMatchInlineSnapshot(`"[]"`)

    expect(sanitizeTestLogs(getLogs())).toMatchInlineSnapshot(`
      "my-namespace Does it even log?
      my-namespace I dont know"
    `)
  })
  test('should log if its enabled', () => {
    const debug = Debug('a-namespace')
    Debug.enable('a-namespace')
    const logs: string[] = []
    debug.log = (...args) => {
      logs.push(stripAnsi(args[0]).trimStart())
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(removeISODate(JSON.stringify(logs, null, 2))).toMatchInlineSnapshot(`
      "[
        \\" a-namespace Does it even log?\\",
        \\" a-namespace I dont know\\"
      ]"
    `)

    expect(sanitizeTestLogs(getLogs())).toMatchInlineSnapshot(`
      "my-namespace Does it even log?
      my-namespace I dont know
      a-namespace Does it even log?
      a-namespace I dont know"
    `)
  })
})
