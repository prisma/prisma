import type { Key } from 'node:readline'

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
  | 'deleteToStart'

export function action(key: Key): ActionKey {
  if (key.ctrl) {
    if (key.name === 'a') return 'first'
    if (key.name === 'c') return 'abort'
    if (key.name === 'd') return 'abort'
    if (key.name === 'e') return 'last'
    if (key.name === 'g') return 'reset'
    if (key.name === 'u') return 'deleteToStart'
    if (key.name === 'w') return 'deleteToStart'
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
