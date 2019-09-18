import { TabIndexContext } from '@prisma/ink-components'
import figures = require('figures')
import { Box, Color } from 'ink'
import React, { useContext, useEffect, useState } from 'react'
import { Key } from 'readline'

export type LinkKind = 'back' | 'forward'

export interface Props {
  label: string
  value?: any
  description?: string
  kind?: LinkKind
  padding?: number
  tabIndex: number
  onSelect: () => void
}

export const Link: React.FC<Props> = props => {
  const { tabIndex, kind, description } = props

  const [focussed, setFocussed] = useState(false)
  const tabCtx = useContext(TabIndexContext)

  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key) {
        if (key.name === 'return' && props.onSelect) {
          props.onSelect()
        }
      },
    }
    tabCtx.register(args)
    return () => {
      tabCtx.unregister(args)
    }
  })

  const backOrForward = kind && (kind === 'back' || kind === 'forward')
  const padding = backOrForward ? 0 : props.padding || 14
  const showSymbol = focussed || backOrForward

  return (
    <Box>
      <Color cyan={focussed}>
        <Box marginRight={1}>
          <Color bold dim={!focussed && backOrForward}>
            {showSymbol ? figures.pointer : ' '}
          </Color>{' '}
          <Color {...{ bold: focussed || backOrForward }}>{props.label.padEnd(padding)}</Color>
        </Box>
        <Color dim>{description || ''}</Color>
      </Color>
    </Box>
  )
}
