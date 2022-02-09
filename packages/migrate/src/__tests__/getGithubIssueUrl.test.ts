import { getGithubIssueUrl } from '../utils/getGithubIssueUrl'
import stripAnsi from 'strip-ansi'

describe('getErrorMessageWithLink', () => {
  test('basic serialization', () => {
    const message = getGithubIssueUrl({
      title: 'This is a title',
      body: 'This is a body',
    })

    expect(stripAnsi(message)).toMatchInlineSnapshot(`TEST_GITHUB_LINK`)
  })
})
