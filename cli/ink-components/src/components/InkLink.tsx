import React from 'react'
import terminalLink from 'terminal-link'

export type InkLinkProps = {
  url: string
}

export const InkLink: React.FC<InkLinkProps> = ({ url }) => <>{terminalLink(url, url, { fallback: () => url })}</>
