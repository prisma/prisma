import { Box, Color } from 'ink'
import React, { useState, useContext, useEffect } from 'react'
import { InkTextInput } from './InkTextInput'
import { TabIndexContext } from '../TabIndex'
import { Key } from 'readline'
import { ActionKey } from '../helpers'
import figures = require('figures')

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mask?: string
  tabIndex: number
}

export const TextInput: React.SFC<TextInputProps> = ({ value, onChange, label, placeholder, mask, tabIndex }) => {
  const [focussed, setFocussed] = useState(false)
  const [keyPressed, setPressedKey] = useState<{ key: ActionKey; str: string } | null>(null)
  const ctx = useContext(TabIndexContext)
  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key, actionKey: ActionKey, text: string) {
        setPressedKey({ key: actionKey, str: text })
      },
    }
    ctx.register(args)
    return () => {
      ctx.unregister(args)
    }
  })

  return (
    <Box>
      <Color cyan={focussed}>
        <Color bold={focussed}>
          {focussed ? figures.pointer + ' ' : '  '}
          {label}
          {': '}
        </Color>
        <InkTextInput
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          keyPressed={keyPressed!}
          showCursor={focussed}
          focus={focussed}
          mask={mask}
        />
      </Color>
    </Box>
  )
}
