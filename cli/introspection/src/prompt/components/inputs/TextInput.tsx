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
  onSubmit?: () => void
}

export const TextInput: React.SFC<TextInputProps> = ({
  value,
  onChange,
  label,
  placeholder,
  mask,
  tabIndex,
  onSubmit,
}) => {
  const [focussed, setFocussed] = useState(false)
  const [keyPressed, setPressedKey] = useState<{ key: ActionKey; str: string; originalKey: Key } | null>(null)
  const ctx = useContext(TabIndexContext)
  useEffect(() => {
    const args = {
      tabIndex,
      onFocus(focus: boolean) {
        setFocussed(focus)
      },
      onKey(key: Key, actionKey: ActionKey, text: string) {
        if (onSubmit && key.name === 'return') {
          onSubmit()
        } else {
          setPressedKey({ key: actionKey, str: text, originalKey: key })
        }
      },
    }
    ctx.register(args)
    return () => {
      ctx.unregister(args)
    }
  })

  return (
    <Color cyan={focussed}>
      <Box textWrap="truncate-middle" marginRight={4}>
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
      </Box>
    </Color>
  )
}
