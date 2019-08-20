import { StdinContext } from 'ink'
import React from 'react'
import { Key } from 'readline'
import { action, ActionKey } from './components/helpers'

export function useStdin(keyHandler: ({ actionKey: ActionKey, text: string, key: Key }) => void, deps: any[] = []) {
  const { stdin, setRawMode } = React.useContext(StdinContext)

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
      didCancel = true
      stdin.removeListener('keypress', handler)
      setRawMode!(false)
    }
  }, [stdin, setRawMode, ...deps])
}
