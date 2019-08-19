import { Box, BoxProps, Color } from 'ink'
import * as React from 'react'
import { COLORS } from '../colors'
import { KeyPressed } from './BoxPrompt'

interface Props extends BoxProps {
  label: string
  checked: boolean
  focus: boolean
  keyPressed: KeyPressed
  onChange: (value: boolean) => void
}

const UNCHECKED_SYMBOL = '□'
const CHECKED_SYMBOL = '■'

export const Checkbox: React.FC<Props> = props => {
  const symbol = props.checked ? CHECKED_SYMBOL : UNCHECKED_SYMBOL
  const { label, checked, focus, onChange, keyPressed, ...rest } = props

  React.useEffect(() => {
    if (focus && (keyPressed.key === 'submit' || keyPressed.str === ' ')) {
      onChange(!checked)
    }
  }, [focus, checked, keyPressed.key, keyPressed.str])

  return (
    <Box {...rest}>
      {checked || focus ? <Color keyword={COLORS.selection}>{symbol}</Color> : symbol}
      <Box marginLeft={1}>{focus ? <Color keyword={COLORS.selection}>{label}</Color> : label}</Box>
    </Box>
  )
}
