import terminalLink from 'terminal-link'
import chalk from 'chalk'

export function link(url) {
  return terminalLink(url, url, {
    fallback: url => chalk.underline(url),
  })
}
