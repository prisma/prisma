import React from 'react'
import { Box, Color, Text } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import figures from 'figures'

export default class Step0StarterVsBlank extends React.Component {
  render() {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" marginLeft={2}>
          <Text bold>Select the language for a starter kit or start with a blank project.</Text>
          <Color dim>Starter kits provide ready-made setups for various use cases.</Color>
        </Box>
        <BorderBox flexDirection="column" title={chalk.bold('Languages for starter kits')} marginTop={1}>
          <Box>
            <Color cyan>
              <Box width={14} marginRight={2}>
                {figures.pointer} <Text bold>JavaScript</Text>
              </Box>
              <Color dim>GraphQL, REST, gRPC, ...</Color>
            </Color>
          </Box>
          <Box>
            <Box width={14} marginLeft={2}>
              TypeScript
            </Box>
            <Color dim>GraphQL, REST, gRPC, ...</Color>
          </Box>
          <Box marginLeft={2}>
            <Color dim>Go (Coming soon)</Color>
          </Box>
          <Box marginLeft={2} marginTop={1}>
            <Color dim>Note: Starter kits only work with empty databases</Color>
          </Box>
        </BorderBox>
        <BorderBox flexDirection="column" title={chalk.bold('Get started from scratch')} marginBottom={1} marginTop={1}>
          <Box>
            <Box width={15} marginLeft={2}>
              Blank project
            </Box>
            <Color dim>Supports introspecting your existing DB</Color>
          </Box>
        </BorderBox>
      </Box>
    )
  }
}
