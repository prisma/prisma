import chalk from 'chalk'
import terminalLink from 'terminal-link'

export function link(urlText: string): string {
  return terminalLink(urlText, urlText, {
    fallback: (url) => chalk.underline(url),
  })
}
