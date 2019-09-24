import figures from 'figures'
import { Box, Color } from 'ink'
import React, { useState, useContext, useEffect } from 'react'
import { TabIndexContext } from './TabIndex'
import { Key } from 'readline'

interface Props {
  label: string
  value: string
  description?: string
  checked: boolean
  onChange: (value: string) => void
  tabIndex: number
}

export const RadioButton: React.FC<Props> = props => {
  const { label, checked, onChange, value, tabIndex } = props

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
          onChange(value)
        }
      },
    }
    ctx.register(args)
    return () => {
      ctx.unregister(args)
    }
  })

  return (
    <Box>
      <Color keyword={focussed ? 'cyan' : 'visible'}>
        {checked ? figures.radioOn : figures.radioOff} {label.padEnd(20)}
        <Color dim>
          {props.description ? props.description.padEnd(20) : ''}
        </Color>
      </Color>
    </Box>
  )
}
