import { Key } from 'readline'
import { CheckboxElement, InputElement, PromptElement, RadioElement, SelectElement, SeparatorElement } from './types'

export function isElementInput(obj: PromptElement): obj is InputElement {
  return obj && obj.type === 'text-input'
}

export function isElementSelect(obj: PromptElement): obj is SelectElement {
  return obj && obj.type === 'select'
}

export function isElementCheckbox(obj: PromptElement): obj is CheckboxElement {
  return obj && obj.type === 'checkbox'
}

export function isElementRadio(obj: PromptElement): obj is RadioElement {
  return obj && obj.type === 'radio'
}

export function isElementSeparator(obj: PromptElement): obj is SeparatorElement {
  return obj && obj.type === 'separator'
}

export function down(cursor: number, elements: PromptElement[]) {
  const length = elements.length

  while (cursor < length - 1 && ['separator'].includes(elements[cursor + 1].type)) {
    cursor++
  }

  return cursor < length - 1 ? cursor + 1 : cursor
}

export function up(cursor: number, elements: PromptElement[]) {
  while (cursor > 0 && ['separator'].includes(elements[cursor - 1].type)) {
    cursor--
  }

  return cursor > 0 ? cursor - 1 : cursor
}

export type ActionKey =
  | false
  | 'first'
  | 'abort'
  | 'last'
  | 'reset'
  | 'submit'
  | 'delete'
  | 'deleteForward'
  | 'next'
  | 'nextPage'
  | 'prevPage'
  | 'up'
  | 'down'
  | 'right'
  | 'left'

export function action(key: Key): ActionKey {
  if (key.ctrl) {
    if (key.name === 'a') return 'first'
    if (key.name === 'c') return 'abort'
    if (key.name === 'd') return 'abort'
    if (key.name === 'e') return 'last'
    if (key.name === 'g') return 'reset'
  }

  if (key.name === 'return') return 'submit'
  if (key.name === 'enter') return 'submit' // ctrl + J
  if (key.name === 'backspace') return 'delete'
  if (key.name === 'delete') return 'deleteForward'
  if (key.name === 'abort') return 'abort'
  if (key.name === 'escape') return 'abort'
  if (key.name === 'tab') return 'next'
  if (key.name === 'pagedown') return 'nextPage'
  if (key.name === 'pageup') return 'prevPage'

  if (key.name === 'up') return 'up'
  if (key.name === 'down') return 'down'
  if (key.name === 'right') return 'right'
  if (key.name === 'left') return 'left'

  return false
}

export const BACK_SYMBOL = process.platform !== 'win32' ? '❮' : '<'
