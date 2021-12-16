process.env.DEBUG = ''

import Debug, { getLogs } from '..'
import stripAnsi from 'strip-ansi'
import { sanitizeTestLogs } from '../util'

describe('debug', () => {
  test('* works as expected', () => {
    const debug = Debug('my-namespace')
    const logs: string[] = []
    debug.log = (...args) => {
      logs.push(stripAnsi(args[0]).trimStart())
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(logs).toMatchInlineSnapshot(`Array []`)

    expect(sanitizeTestLogs(getLogs())).toMatchInlineSnapshot(`
      "my-namespace Does it even log?
      my-namespace I dont know"
    `)
  })
})
