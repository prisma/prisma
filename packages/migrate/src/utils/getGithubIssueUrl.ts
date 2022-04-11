import { getPlatform } from '@prisma/get-platform'
import newGithubIssueUrl from 'new-github-issue-url'
import open from 'open'
import prompt from 'prompts'
import stripAnsi from 'strip-ansi'

export function getGithubIssueUrl({
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
  return newGithubIssueUrl({
    user,
    repo,
    template,
    title,
    body,
  })
}

interface IssueOptions {
  error: any
  cliVersion: string
  engineVersion: string
  command: string
  prompt: Boolean
  title?: string
  reportId?: number
}

export async function wouldYouLikeToCreateANewIssue(options: IssueOptions) {
  let shouldCreateNewIssue

  if (options.prompt) {
    shouldCreateNewIssue = await prompt({
      type: 'select',
      name: 'value',
      message: 'Would you like to create a GitHub issue?',
      initial: 0,
      choices: [
        {
          title: 'Yes',
          value: true,
          description: `Create a new GitHub issue`,
        },
        {
          title: 'No',
          value: false,
          description: `Don't create a new GitHub issue`,
        },
      ],
    })
  } else {
    shouldCreateNewIssue = { value: true }
  }

  if (shouldCreateNewIssue.value) {
    const platform = await getPlatform()

    const url = getGithubIssueUrl({
      title: options.title ?? '',
      body: issueTemplate(platform, options),
    })
    await open(url)
  }
}

const issueTemplate = (platform: string, options: IssueOptions) => {
  return stripAnsi(`
Hi Prisma Team! Prisma Migrate just crashed. ${
    options.reportId
      ? `This is the report:
  Report Id: ${options.reportId}`
      : ''
  }

## Command

\`${options.command}\`

## Versions
      
| Name        | Version            |
|-------------|--------------------|
| Platform    | ${platform.padEnd(19)}| 
| Node        | ${process.version.padEnd(19)}| 
| Prisma CLI  | ${options.cliVersion.padEnd(19)}| 
| Engine      | ${options.engineVersion.padEnd(19)}| 

## Error
\`\`\`
${options.error}
\`\`\`

`)
}
