process.env.DEBUG = ''

import Debug, { getLogs } from '..'
import stripAnsi from 'strip-ansi'

describe('debug', () => {
  test('* works as expected', () => {
    const debug = Debug('my-namespace')
    const logs = []
    debug.log = (...args) => {
      logs.push(args.map(stripAnsi))
    }
    debug('Does it even log?')
    debug('I dont know')

    expect(logs).toMatchInlineSnapshot(`Array []`)

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
