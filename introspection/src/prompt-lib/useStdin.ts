import { StdinContext } from 'ink'
import * as React from 'react'
import { Key } from 'readline'
import { action, ActionKey } from './helpers'

export function useStdin(keyHandler: (key: ActionKey, text: string) => void, deps: any[] = []) {
  const { stdin, setRawMode } = React.useContext(StdinContext)

  let didCancel = false

  React.useEffect(() => {
    function handler(str: string, key: Key) {
      if (!didCancel) {
        keyHandler(action(key), str)
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
