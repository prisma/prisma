import { QueryEngineErrorWithLink } from '../Engine'
import Debug from '@prisma/debug'
import stripAnsi from 'strip-ansi'

describe('QueryEngineErrorWithLink', () => {
  test('basic serialization', () => {
    const debug = Debug('test-namespace')
    debug('hello')
    const error = new QueryEngineErrorWithLink({
      platform: 'darwin',
      title: 'This is a title',
      version: '1.2.3',
      description: 'This is some crazy description',
    })
    expect(stripAnsi(error.message)).toMatchInlineSnapshot(`
      "This is a title

      This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.
      If you want the Prisma team to look into it, please cmd+click on the link below 
      and press the \\"Submit new issue\\" button 🙏

      https://github.com/prisma/prisma-client-js/issues/new?body=Hi+Prisma+Team%21+My+Prisma+Client+just+crashed.+This+is+the+report%3A%0A%23%23+Versions%0A%0A%7C+Name+++++%7C+Version++++++++++++%7C%0A%7C----------%7C--------------------%7C%0A%7C+Node+++++%7C+v12.16.3+++++++++++%7C+%0A%7C+OS+++++++%7C+darwin+++++++++++++%7C%0A%7C+Prisma+++%7C+1.2.3++++++++++++++%7C%0A%0A%23%23+Logs%0A%60%60%60%0A++test-namespace+hello++%2B0ms%0A%60%60%60%0A%23+Description%0AThis+is+some+crazy+description&title=This+is+a+title&template=bug_report.md"
    `)
  })
})
