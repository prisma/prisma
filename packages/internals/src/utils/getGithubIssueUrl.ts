import { getPlatform } from '@prisma/get-platform'
import isWindows from 'is-windows'
import isWSL from 'is-wsl'
import newGithubIssueUrl from 'new-github-issue-url'
import open from 'open'
import prompt from 'prompts'
import stripAnsi from 'strip-ansi'
import { match } from 'ts-pattern'

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
  const shouldCreateNewIssue = await match(options.prompt)
    .with(true, async () => {
      const createNewIssueResponse = await prompt({
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
      // @types/prompts is broken, and doesn't infer the types of the `value` prop,
      // thus we explicitly cast it to boolean.
      return Boolean(createNewIssueResponse.value)
    })
    .otherwise(() => Promise.resolve(true))

  if (shouldCreateNewIssue) {
    const platform = await getPlatform()

    const url = getGithubIssueUrl({
      title: options.title ?? '',
      body: issueTemplate(platform, options),
    })

    /**
     * This is a workaround for a quirky `open` behavior.
     * - `await open(url)` correctly opens the browser, returns the control to Node.js and let it exit the process normally.
     * - `await open(url, { wait: true })` achieves the same on Windows and WSL. Without `{ wait: true }`, `open` would not
     *   return the control to the Node.js process, which would result in the prisma cli being stuck.
     */
    const shouldOpenWait = isWindows() || isWSL
    await open(url, { wait: shouldOpenWait })
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
