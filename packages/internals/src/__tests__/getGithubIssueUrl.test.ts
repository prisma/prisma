import stripAnsi from 'strip-ansi'

import { getGithubIssueUrl } from '../utils/getGithubIssueUrl'

describe('getErrorMessageWithLink', () => {
  test('basic serialization', () => {
    const message = getGithubIssueUrl({
      title: 'This is a title',
      body: 'This is a body',
    })

    expect(stripAnsi(message)).toMatchInlineSnapshot(
      `"https://github.com/prisma/prisma/issues/new?body=This+is+a+body&title=This+is+a+title&template=bug_report.md"`,
    )
  })
})
