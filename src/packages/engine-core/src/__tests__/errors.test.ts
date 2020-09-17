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
      stripAnsi(message)
        .replace(/v\d{1,2}\.\d{1,2}\.\d{1,2}/, 'NODE_VERSION')
        .replace(/[\+-]/g, ''),
    ).toMatchInlineSnapshot(`
      "This is a title

      This is a nonrecoverable error which probably happens when the Prisma Query Engine has a panic.

      https://github.com/prisma/prismaclientjs/issues/new?body=HiPrismaTeam%21MyPrismaClientjustcrashed.Thisisthereport%3A%0A%23%23Versions%0A%0A%7CName%7CVersion%7C%0A%7C%7C%7C%0A%7CNode%7CNODE_VERSION%7C%0A%7COS%7Cdarwin%7C%0A%7CPrismaClient%7C1.2.3%7C%0A%0A%23Description%0A%60%60%60%0AThisissomecrazydescription%0A%60%60%60%0A%0A%23%23Logs%0A%60%60%60%0Atestnamespacehello%0A%60%60%60&title=Thisisatitle&template=bug_report.md

      If you want the Prisma team to look into it, please open the link above 🙏
      "
    `)
  })
})
