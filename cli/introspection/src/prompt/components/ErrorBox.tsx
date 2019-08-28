import React from 'react'
import { Box, Color } from 'ink'

export const ErrorBox: React.FC = props => (
  <Box>
    <Color bgRed white bold>
      {' ERROR '}
    </Color>{' '}
    <Color red>{props.children}</Color>
  </Box>
)

export const FixBox: React.FC = props => (
  <Box>
    <Color bgWhite black bold>
      {' FIX '}
    </Color>{' '}
    <Color white>{props.children}</Color>
  </Box>
)
