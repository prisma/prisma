// Text input forked from ink-text-input
import chalk from 'chalk'
import { Color, Box } from 'ink'
import React, { useEffect, useState } from 'react'
import { ActionKey } from '../helpers'
import { Key } from 'readline'

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

export type KeyPressed = {
  key: ActionKey
  str: string
  originalKey: Key
}

export const InkTextInput: React.FC<Props> = props => {
  const [cursorOffset, setCursorOffset] = useState((props.value || '').length)
  const [cursorWidth, setCursorWidth] = useState(0)

  useEffect(() => {
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

    let tmpCursorOffset = cursorOffset
    let value = originalValue
    let cursorWidth = 0

    // ux shortcut to take the placeholder value
    if (originalValue === '' && placeholder && ['right', 'tab', 'return'].includes(keyPressed.originalKey.name!)) {
      value = placeholder
      tmpCursorOffset = value.length
      setCursorOffset(tmpCursorOffset)
      onChange(value)
      return
    }

    if (keyPressed.originalKey.name === 'return') {
      return
    }

    if (actionKey === 'deleteToStart') {
      value = value.substr(tmpCursorOffset, value.length)
      tmpCursorOffset = 0
    } else if (actionKey === 'first') {
      if (showCursor && !mask) {
        tmpCursorOffset = 0
      }
    } else if (actionKey === 'last') {
      if (showCursor && !mask) {
        tmpCursorOffset = value.length
      }
    } else if (actionKey === 'left') {
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

    renderedValue += invertString(value, cursorOffset, cursorActualWidth)

    if (value.length > 0 && cursorOffset === value.length) {
      renderedValue += chalk.inverse(' ')
    }
  }

  if (mask) {
    renderedValue = mask.repeat(renderedValue.length)
  }

  const renderedPlaceholder = focus && placeholder && !hasValue ? invertString(placeholder, 0, 0) : placeholder

  return (
    <Color dim={!hasValue && !!placeholder} cyan={focus}>
      {placeholder ? (hasValue ? renderedValue : renderedPlaceholder) : renderedValue}
    </Color>
  )
}

function invertString(str: string, from: number, width: number) {
  let resultStr = ''
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i)
    // if in interval, invert it
    if (i >= from && i <= from + width) {
      resultStr += chalk.inverse(char)
    } else {
      resultStr += char
    }
  }

  return resultStr
}

InkTextInput.defaultProps = {
  placeholder: '',
  showCursor: true,
  focus: true,
  mask: undefined,
  highlightPastedText: false,
  onSubmit: undefined,
}
