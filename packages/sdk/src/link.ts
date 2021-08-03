import terminalLink from 'terminal-link'
import chalk from 'chalk'

export function link(url): string {
  return terminalLink(url, url, {
    fallback: (url) => chalk.underline(url),
  })
}
