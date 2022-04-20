import chalk from 'chalk'
import terminalLink from 'terminal-link'

export function link(url): string {
  return terminalLink(url, url, {
    fallback: (url) => chalk.underline(url),
  })
}
