import React from 'react'
import { Key } from 'readline'
import { useStdin } from '../hooks/useStdin'
import { ActionKey } from '../helpers'
import Debug from 'debug'
const debug = Debug('TabIndex')

interface TabIndexRegisterArgs {
  tabIndex: number
  onFocus: (focus: boolean) => void
  onKey: (key: Key, actionKey: ActionKey, text: string) => void
}

class TabIndexContextClass {
  components: TabIndexRegisterArgs[] = []
  activeIndex = 0
  locked: boolean = false
  register = (args: TabIndexRegisterArgs) => {
    const countBefore = this.components.length
    if (!this.components.includes(args)) {
      this.components.splice(args.tabIndex, 0, args)
    }
    if (countBefore === 0) {
      args.onFocus(true)
    } else {
      const index = this.components.indexOf(args)
      args.onFocus(index === this.activeIndex)
    }
  }
  unregister = (args: TabIndexRegisterArgs) => {
    const index = this.components.indexOf(args)
    if (index > -1) {
      this.components.splice(index, 1)
    }
  }
  setActiveIndex = (i: number) => {
    if (this.locked) {
      return
    }
    if (this.activeIndex !== i) {
      if (this.components[this.activeIndex]) {
        this.components[this.activeIndex].onFocus(false)
      }
      this.activeIndex = i
      if (this.components[i]) {
        this.components[i].onFocus(true)
      }
    }
  }
  up() {
    const componentsCount = this.components.length
    this.setActiveIndex(
      (this.activeIndex - 1 + componentsCount) % componentsCount,
    )
  }
  down() {
    const componentsCount = this.components.length
    this.setActiveIndex((this.activeIndex + 1) % componentsCount)
  }
  emitKeyPress(key: Key, actionKey: ActionKey, text: string) {
    if (this.components[this.activeIndex]) {
      this.components[this.activeIndex].onKey(key, actionKey, text)
    }
  }
  lockNavigation(lock: boolean) {
    this.locked = lock
  }
}

export const tabIndexContextState = new TabIndexContextClass()

export const TabIndexContext = React.createContext(tabIndexContextState)

export function TabIndexProvider(props) {
  useStdin(({ key, actionKey, text }) => {
    if (key.name === 'up' || (key.name === 'tab' && key.shift)) {
      tabIndexContextState.up()
    } else if (key.name === 'down' || key.name === 'tab') {
      tabIndexContextState.down()
    } else {
      tabIndexContextState.emitKeyPress(key, actionKey, text)
    }
  })

  return (
    <TabIndexContext.Provider value={tabIndexContextState}>
      {props.children}
    </TabIndexContext.Provider>
  )
}
