import React, { useContext, useEffect } from 'react'
import { TabIndexContext } from './TabIndex'

export type Props = {
  tabIndex: number
}

const DummySelectable: React.FC<Props> = props => {
  const ctx = useContext(TabIndexContext)
  useEffect(() => {
    const args = {
      tabIndex: props.tabIndex,
      onFocus() {
        // ignore
      },
      onKey() {
        // ignore
      },
    }
    ctx.register(args)
    return () => {
      ctx.unregister(args)
    }
  })

  return <>{props.children}</>
}

export default DummySelectable
