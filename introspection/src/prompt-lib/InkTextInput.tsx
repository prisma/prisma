// Text input forked from ink-text-input
import chalk from 'chalk'
import { Color } from 'ink'
import * as React from 'react'
import { KeyPressed } from './BoxPrompt'

type Props = {
  value: string
  placeholder?: string
  focus?: boolean
  mask?: string
  highlightPastedText?: boolean
  showCursor?: boolean
  keyPressed: KeyPressed
  onChange: (text: string) => void
  onSubmit?: (text: string) => void
}

// TODO: Debug why useStdin is rendered 5 times
export const InkTextInput: React.FC<Props> = props => {
  const [cursorOffset, setCursorOffset] = React.useState((props.value || '').length)
  const [cursorWidth, setCursorWidth] = React.useState(0)

  React.useEffect(() => {
    const { value: originalValue, focus, showCursor, mask, onChange, onSubmit, keyPressed } = props

    if (!keyPressed) {
      return
    }

    const str = String(keyPressed.str)
    const actionKey = keyPressed.key

    if (!actionKey && str === 'undefined') {
      return
    }

    if (focus === false) {
      return
    }

    if (actionKey === 'up' || actionKey === 'down' || actionKey === 'abort' || actionKey === 'next') {
      return
    }

    if (actionKey === 'submit') {
      if (onSubmit) {
        onSubmit(originalValue)
      }

      return
    }

    let tmpCursorOffset = cursorOffset
    let value = originalValue
    let cursorWidth = 0

    if (actionKey === 'left') {
      if (showCursor && !mask) {
        tmpCursorOffset--
      }
    } else if (actionKey === 'right') {
      if (showCursor && !mask) {
        tmpCursorOffset++
      }
    } else if (actionKey === 'delete') {
      value = value.substr(0, tmpCursorOffset - 1) + value.substr(tmpCursorOffset, value.length)
      tmpCursorOffset--
    } else {
      value = value.substr(0, tmpCursorOffset) + str + value.substr(tmpCursorOffset, value.length)
      tmpCursorOffset += str.length

      if (str.length > 1) {
        cursorWidth = str.length
      }
    }

    if (tmpCursorOffset < 0) {
      tmpCursorOffset = 0
    }

    if (tmpCursorOffset > value.length) {
      tmpCursorOffset = value.length
    }

    setCursorOffset(tmpCursorOffset)
    setCursorWidth(cursorWidth)

    if (value !== originalValue) {
      onChange(value)
    }
  }, [props.keyPressed])

  const { value, placeholder, showCursor, focus, mask, highlightPastedText } = props
  const hasValue = value.length > 0
  let renderedValue = value
  const cursorActualWidth = highlightPastedText ? cursorWidth : 0

  // Fake mouse cursor, because it's too inconvenient to deal with actual cursor and ansi escapes
  if (showCursor && !mask && focus) {
    renderedValue = value.length > 0 ? '' : chalk.inverse(' ')

    let i = 0
    for (const char of value) {
      if (i >= cursorOffset - cursorActualWidth && i <= cursorOffset) {
        renderedValue += chalk.inverse(char)
      } else {
        renderedValue += char
      }

      i++
    }

    if (value.length > 0 && cursorOffset === value.length) {
      renderedValue += chalk.inverse(' ')
    }
  }

  if (mask) {
    renderedValue = mask.repeat(renderedValue.length)
  }

  return (
    <Color dim={!hasValue && !!placeholder && !focus} cyan={focus}>
      {placeholder ? (hasValue ? renderedValue : placeholder) : renderedValue}
    </Color>
  )
}

InkTextInput.defaultProps = {
  placeholder: '',
  showCursor: true,
  focus: true,
  mask: undefined,
  highlightPastedText: false,
  onSubmit: undefined,
}
