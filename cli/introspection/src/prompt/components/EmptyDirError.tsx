import React from 'react'
import { ErrorBox, FixBox } from '@prisma/ink-components'
import { Color, Box } from 'ink'

const EmptyDirError: React.FC = () => (
  <Box textWrap="wrap" flexDirection="column">
    <ErrorBox>
      <Box flexDirection="column">
        <Color>Starter kits can only be selected in empty directories </Color>
        <Color>
          or by providing a project name to the <Color bold>prisma2 init</Color> command
        </Color>
      </Box>
    </ErrorBox>
    <FixBox>
      <Color>Run the command in an empty directory or provide a project name, e.g.: </Color>
      <Color bold>prisma2 init hello-world</Color>
    </FixBox>
  </Box>
)

export default EmptyDirError
