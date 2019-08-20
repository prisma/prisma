import { Box, Color } from 'ink'
import React, { useContext, useEffect, useState } from 'react'
import { BACK_SYMBOL } from './helpers'
import figures = require('figures')
import { TabIndexContext } from './TabIndex'
import { Key } from 'readline'
import { RouterContext } from './Router'

export type LinkKind = 'back' | 'forward'

export interface Props {
  label: string
  value?: any
  description?: string
  kind?: LinkKind
  padding?: number
  tabIndex: number
  href: string
}

function getSymbol(kind?: LinkKind) {
  if (kind && kind === 'back') {
    return BACK_SYMBOL
  }

  return figures.pointer
}

export const Link: React.FC<Props> = props => {
  const { tabIndex, kind, description } = props

  const [focussed, setFocussed] = useState(false)
  const tabCtx = useContext(TabIndexContext)
  const routerCtx = useContext(RouterContext)

  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key) {
        if (key.name === 'return') {
          routerCtx.setRoute(props.href)
        }
      },
    }
    tabCtx.register(args)
    return () => {
      tabCtx.unregister(args)
    }
  })

  const padding = props.padding || 20

  const backOrForward = kind && (kind === 'back' || kind === 'forward')
  const showSymbol = focussed || backOrForward

  return (
    <Box>
      <Color cyan={focussed}>
        <Box width={14} marginRight={2}>
          <Color bold dim={!focussed && backOrForward}>
            {showSymbol ? getSymbol(kind) : ' '}
          </Color>{' '}
          <Color {...{ bold: focussed || backOrForward }}>{props.label.padEnd(padding)}</Color>
        </Box>
        <Color dim>{description || ''}</Color>
      </Color>
    </Box>
  )
}
