import { underline } from 'kleur/colors'

export async function link(url): Promise<string> {
  const { default: terminalLink } = await import('terminal-link')
  return terminalLink(url, url, {
    fallback: (url) => underline(url),
  })
}
