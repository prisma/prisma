import { underline } from 'kleur/colors'
import terminalLink from 'terminal-link'

export function link(url): string {
  return terminalLink(url, url, {
    fallback: underline,
  })
}
