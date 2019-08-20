import React, { useState } from 'react'
import { Box, Color } from 'ink'
import BorderBox from '../components/BorderBox'
import { TextInput } from '../components/inputs/TextInput'
import { Checkbox } from '../components/inputs/Checkbox'
import { Link } from '../components/Link'

export function TabApp2() {
  const [value0, setValue0] = useState('')
  const [value1, setValue1] = useState('')
  const [value2, setValue2] = useState('')
  const [value3, setValue3] = useState(false)

  return (
    <Box marginTop={1} flexDirection="column">
      <Color bold>This is a title 2</Color>
      <Color dim>This is TabApp 2</Color>
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
        <Link href="home" label="Hellooo" tabIndex={4} />
      </BorderBox>
      <Box marginTop={1} flexDirection="column">
        <Link href="home" label="Create" tabIndex={5} kind="forward" />
        <Link href="home" label="Back" tabIndex={6} kind="back" description="(Database options)" />
      </Box>
    </Box>
  )
}
