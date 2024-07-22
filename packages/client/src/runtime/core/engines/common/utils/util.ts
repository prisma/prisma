import newGitHubIssueUrl from 'new-github-issue-url'

export function getGitHubIssueUrl({
  title,
  user = 'prisma',
  repo = 'prisma',
  template = 'bug_report.yml',
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
