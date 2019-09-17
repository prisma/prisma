import React from 'react'
import { Box, Color } from 'ink'

export const SuccessBox: React.FC = props => (
  <Color green>
    <Color bgKeyword="green" white>
      <Color bold> SUCCESS </Color>
    </Color>{' '}
    {props.children}
  </Color>
)

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
