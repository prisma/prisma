import { getErrorMessageWithLink } from '../Engine'
import Debug from '@prisma/debug'
import stripAnsi from 'strip-ansi'

describe('getErrorMessageWithLink', () => {
  test('basic serialization', () => {
    const debug = Debug('test-namespace')
    debug('hello')
    const message = getErrorMessageWithLink({
      platform: 'darwin',
      title: 'This is a title',
      version: '1.2.3',
      description: 'This is some crazy description',
    })
    expect(
      stripAnsi(message).replace(/v\d{1,2}\.\d{1,2}\.\d{1,2}/, 'NODE_VERSION'),
    ).toMatchInlineSnapshot(`
      "This is a title

      This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

      https://github.com/prisma/prisma-client-js/issues/new?body=Hi+Prisma+Team%21+My+Prisma+Client+just+crashed.+This+is+the+report%3A%0A%23%23+Versions%0A%0A%7C+Name+++++%7C+Version++++++++++++%7C%0A%7C----------%7C--------------------%7C%0A%7C+Node+++++%7C+NODE_VERSION+++++++++++%7C+%0A%7C+OS+++++++%7C+darwin+++++++++++++%7C%0A%7C+Prisma+++%7C+1.2.3++++++++++++++%7C%0A%0A%23+Description%0A%60%60%60%0AThis+is+some+crazy+description%0A%60%60%60%0A%0A%23%23+Logs%0A%60%60%60%0A++test-namespace+hello++%2B0ms%0A%60%60%60&title=This+is+a+title&template=bug_report.md

      If you want the Prisma team to look into it, please open the link above 🙏
      "
    `)
  })
})
