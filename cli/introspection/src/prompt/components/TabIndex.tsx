import React, { useEffect, useContext, useState } from 'react'
import { Box, Color } from 'ink'
import { Key } from 'readline'
import { useStdin } from '../useStdin'
import BorderBox from './BorderBox'
import { ActionKey } from './helpers'
import { TextInput } from './inputs/TextInput'
import { Checkbox } from './inputs/Checkbox'
import { Link } from './Link'

interface TabIndexRegisterArgs {
  tabIndex: number
  onFocus: (focus: boolean) => void
  onKey: (key: Key, actionKey: ActionKey, text: string) => void
}

class TabIndexContextClass {
  components: TabIndexRegisterArgs[] = []
  activeIndex = 0
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
  setActiveIndex = i => {
    if (this.activeIndex !== i) {
      this.components[this.activeIndex].onFocus(false)
      this.activeIndex = i
      this.components[i].onFocus(true)
    }
  }
  up() {
    const componentsCount = this.components.length
    this.setActiveIndex((this.activeIndex - 1 + componentsCount) % componentsCount)
  }
  down() {
    const componentsCount = this.components.length
    this.setActiveIndex((this.activeIndex + 1) % componentsCount)
  }
  emitKeyPress(key: Key, actionKey: ActionKey, text: string) {
    this.components[this.activeIndex].onKey(key, actionKey, text)
  }
}

const contextState = new TabIndexContextClass()

export const TabIndexContext = React.createContext(contextState)

export function TabIndexProvider(props) {
  const [state, setState] = React.useState(contextState)

  useStdin(({ key, actionKey, text }) => {
    if (key.name === 'up' || (key.name === 'tab' && key.shift)) {
      state.up()
    } else if (key.name === 'down' || key.name === 'tab') {
      state.down()
    } else {
      state.emitKeyPress(key, actionKey, text)
    }
  })

  return <TabIndexContext.Provider value={state}>{props.children}</TabIndexContext.Provider>
}

export function TabApp() {
  const [value0, setValue0] = React.useState('')
  const [value1, setValue1] = React.useState('')
  const [value2, setValue2] = React.useState('')
  const [value3, setValue3] = React.useState(false)

  return (
    <TabIndexProvider>
      <Box marginTop={1} flexDirection="column">
        <Color bold>This is a title</Color>
        <Color dim>Lorem ipsum dolor sit amet consectetur, adipisicing elit. </Color>
        <BorderBox title="Some Title" flexDirection="column" marginTop={1}>
          <TextInput
            label="some labe"
            value={value0}
            placeholder="this is a placeholder"
            tabIndex={0}
            onChange={setValue0}
          />
          <Color dim>{'  '}Some other text</Color>
          <TextInput label="some lable" value={value1} tabIndex={1} onChange={setValue1} />
          <TextInput label="lubel" value={value2} tabIndex={2} onChange={setValue2} />
          <Checkbox checked={value3} onChange={setValue3} tabIndex={3} label="This is a checkbox" />
          <Link href="asd" label="Hellooo" tabIndex={4} />
        </BorderBox>
        <Box marginTop={1} flexDirection="column">
          <Link href="asd" label="Create" tabIndex={5} kind="forward" />
          <Link href="asd" label="Back" tabIndex={6} kind="back" description="(Database options)" />
        </Box>
      </Box>
    </TabIndexProvider>
  )
}
