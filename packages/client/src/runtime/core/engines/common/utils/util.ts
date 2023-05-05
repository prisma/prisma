import crypto from 'crypto'
import newGitHubIssueUrl from 'new-github-issue-url'

export function getGitHubIssueUrl({
  title,
  user = 'prisma',
  repo = 'prisma',
  template = 'bug_report.md',
  body,
}: {
  title: string
  user?: string
  repo?: string
  template?: string
  body?: string
}): string {
  return newGitHubIssueUrl({
    user,
    repo,
    template,
    title,
    body,
  })
}

export function getRandomString() {
  return crypto.randomBytes(12).toString('hex')
}
