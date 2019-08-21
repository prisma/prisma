import { Box, BoxProps, Color } from 'ink'
import React, { useState, useContext, useEffect } from 'react'
import { TabIndexContext } from '../TabIndex'
import { Key } from 'readline'
import figures = require('figures')

interface Props extends BoxProps {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  tabIndex: number
  description?: string
  padding?: number
}

export const Checkbox: React.FC<Props> = props => {
  const symbol = props.checked ? figures.checkboxOn : figures.checkboxOff
  const { label, checked, onChange, tabIndex, description, ...rest } = props
  let { padding } = props
  padding = padding || 8

  const [focussed, setFocussed] = useState(false)
  const ctx = useContext(TabIndexContext)

  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key) {
        if (key.name === 'space') {
          onChange(!checked)
        }
      },
    }
    ctx.register(args)
    return () => {
      ctx.unregister(args)
    }
  }, [checked])

  return (
    <Box {...rest}>
      <Color cyan={focussed}>
        {focussed ? figures.pointer + ' ' : '  '}
        {symbol} {label.padEnd(padding)}
        {description ? <Color dim>{description}</Color> : null}
      </Color>
    </Box>
  )
}
