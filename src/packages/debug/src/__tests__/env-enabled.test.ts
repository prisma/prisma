process.env.DEBUG = 'my-namespace'

import Debug, { getLogs } from '..'
import stripAnsi from 'strip-ansi'
import { removeISODate } from '../util'

describe('debug', () => {
  test('env vars work as expected', () => {
    const debug = Debug('my-namespace')
    const logs = []
    debug.log = (...args) => {
      logs.push(args.map(stripAnsi))
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(removeISODate(JSON.stringify(logs, null, 2))).toMatchInlineSnapshot(`
      "[
        [
          \\" my-namespace Does it even log?\\"
        ],
        [
          \\" my-namespace I dont know\\"
        ]
      ]"
    `)

    expect(
      stripAnsi(getLogs())
        .split('\n')
        .map((l) => l.slice(25))
        .join('\n'),
    ).toMatchInlineSnapshot(`
      "my-namespace Does it even log?
      my-namespace I dont know"
    `)
  })
})
