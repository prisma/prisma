process.env.DEBUG = 'my-namespace'

import Debug, { getLogs } from '..'
import stripAnsi from 'strip-ansi'
import { removeISODate, sanitizeTestLogs } from '../util'

describe('debug', () => {
  test('env vars work as expected', () => {
    const debug = Debug('my-namespace')
    const logs: string[] = []
    debug.log = (...args) => {
      logs.push(stripAnsi(args[0]).trimStart())
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(removeISODate(JSON.stringify(logs, null, 2))).toMatchInlineSnapshot(`
      "[
        \\" my-namespace Does it even log?\\",
        \\" my-namespace I dont know\\"
      ]"
    `)

    expect(sanitizeTestLogs(getLogs())).toMatchInlineSnapshot(`
      "my-namespace Does it even log?
      my-namespace I dont know"
    `)
  })
})
