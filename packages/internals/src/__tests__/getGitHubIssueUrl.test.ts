import stripAnsi from 'strip-ansi'

import { getGitHubIssueUrl } from '../utils/getGitHubIssueUrl'

describe('getErrorMessageWithLink', () => {
  test('basic serialization', () => {
    const message = getGitHubIssueUrl({
      title: 'This is a title',
      body: 'This is a body',
    })

    expect(stripAnsi(message)).toMatchInlineSnapshot(
      `"https://github.com/prisma/prisma/issues/new?body=This+is+a+body&title=This+is+a+title&template=bug_report.md"`,
    )
  })
})
