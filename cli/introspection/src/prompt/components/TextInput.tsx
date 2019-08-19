import { Box, Color } from 'ink'
import * as React from 'react'
import { COLORS } from '../colors'
import { KeyPressed } from './BoxPrompt'
import { InkTextInput } from './InkTextInput'

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  focus: boolean
  mask?: string
  keyPressed: KeyPressed
}

export const TextInput: React.SFC<TextInputProps> = ({
  value,
  onChange,
  label,
  focus,
  placeholder,
  mask,
  keyPressed,
}) => (
  <Box>
    <Box marginRight={1}>{focus ? <Color keyword={COLORS.selection}>{label}</Color> : label}</Box>
    <InkTextInput
      value={value}
      placeholder={placeholder}
      onChange={value => {
        if (focus) {
          onChange(value)
        }
      }}
      keyPressed={keyPressed}
      showCursor={focus}
      focus={focus}
      mask={mask}
    />
  </Box>
)
