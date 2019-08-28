import { Box, Color } from 'ink'
import React, { useContext, useEffect, useState } from 'react'
import { BACK_SYMBOL } from './helpers'
import figures = require('figures')
import { TabIndexContext } from './TabIndex'
import { Key } from 'readline'
import { RouterContext } from './Router'
import { useInitState, InitState } from './InitState'

export type LinkKind = 'back' | 'forward'

export interface Props {
  label: string
  value?: any
  description?: string
  kind?: LinkKind
  padding?: number
  tabIndex: number
  href?: string
  state?: Partial<InitState>
  onSelect?: () => void
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
  const initStore = useInitState()[1]

  if (!props.href && !props.onSelect && props.kind !== 'back') {
    throw new Error(`Links that don't have an "href" need to have kind="back"`)
  }

  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key) {
        if (key.name === 'return') {
          if (props.state) {
            initStore.setState(props.state)
          }
          if (props.onSelect) {
            props.onSelect()
          } else {
            tabCtx.setActiveIndex(0)
            routerCtx.setRoute(props.href || routerCtx.lastRoute!)
          }
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
            {showSymbol ? getSymbol(kind) : ' '}
          </Color>{' '}
          <Color {...{ bold: focussed || backOrForward }}>{props.label.padEnd(padding)}</Color>
        </Box>
        <Color dim>{description || ''}</Color>
      </Color>
    </Box>
  )
}
