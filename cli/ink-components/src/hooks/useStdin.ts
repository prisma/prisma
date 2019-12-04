import { useStdin as inkUseStdin } from 'ink'
import React from 'react'
import { Key, emitKeypressEvents } from 'readline'
import { action } from '../helpers'

export function useStdin(
  keyHandler: ({ actionKey: ActionKey, text: string, key: Key }) => void,
  deps: any[] = [],
) {
  let { stdin, setRawMode } = inkUseStdin()

  // stdin = stdin || process.stdin
  // setRawMode = setRawMode || process.stdin.setRawMode

  emitKeypressEvents(stdin)

  let didCancel = false

  React.useEffect(() => {
    function handler(text: string, key: Key) {
      if (!didCancel) {
        keyHandler({ actionKey: action(key), text, key })
      }
    }

    setRawMode!(true)
    stdin.on('keypress', handler)

    return () => {
      // didCancel = true
      stdin.removeListener('keypress', handler)
      setRawMode!(false)
    }
  }, [stdin, setRawMode, ...deps])
}
