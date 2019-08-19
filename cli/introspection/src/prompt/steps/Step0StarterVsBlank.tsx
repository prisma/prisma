import React from 'react'
import { Box, Color, Text } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import figures from 'figures'
import { useStdin } from '../useStdin'
import { SelectItem } from '../components/SelectItem'

export type StarterSelection = 'js' | 'ts' | 'blank'

export interface Props {
  onSubmit: (selection: StarterSelection) => void
}

const selectionMapping: StarterSelection[] = ['js', 'ts', 'blank']

export default function Step0StarterVsBlank({ onSubmit }: Props) {
  const [selectedIndex, selectIndex] = React.useState(0)

  useStdin(
    async ({ actionKey, text, key }) => {
      if (key.name === 'space' || key.name === 'return') {
        onSubmit(selectionMapping[selectedIndex])
      }

      if (key.name === 'down') {
        selectIndex((selectedIndex + 1) % 3)
      }

      if (key.name === 'up') {
        selectIndex((selectedIndex - 1 + 3) % 3)
      }
    },
    [selectedIndex],
  )

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Text bold>Select the language for a starter kit or start with a blank project.</Text>
        <Color dim>Starter kits provide ready-made setups for various use cases.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Languages for starter kits')} marginTop={1}>
        <SelectItem
          focus={selectedIndex === 0}
          label="JavaScript"
          description="GraphQL, REST, gRPC, ..."
          onSelect={() => onSubmit('js')}
          padding={10}
        />
        <SelectItem
          focus={selectedIndex === 1}
          label="TypeScript"
          description="GraphQL, REST, gRPC, ..."
          onSelect={() => onSubmit('ts')}
          padding={10}
        />
        <Box marginLeft={2}>
          <Color dim>Go (Coming soon)</Color>
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Color dim>Note: Starter kits only work with empty databases</Color>
        </Box>
      </BorderBox>
      <BorderBox flexDirection="column" title={chalk.bold('Get started from scratch')} marginBottom={1} marginTop={1}>
        <SelectItem
          focus={selectedIndex === 2}
          label="Blank project"
          description="Supports introspecting your existing DB"
          onSelect={() => onSubmit('blank')}
          padding={10}
        />
      </BorderBox>
    </Box>
  )
}
