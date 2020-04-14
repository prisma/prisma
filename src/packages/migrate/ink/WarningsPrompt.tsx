import { TabIndexProvider, TextInput } from '@prisma/ink-components'
import chalk from 'chalk'
import { Box, Color } from 'ink'
import React, { useState } from 'react'
import { EngineResults } from '../types'

export interface WarningsPromptProps {
  warnings: EngineResults.Warning[]
  onSubmitWarningsPrompt: (ok: boolean) => void
}

export const WarningsPrompt: React.FC<WarningsPromptProps> = ({ warnings, onSubmitWarningsPrompt }) => {
  const [value, setValue] = useState('')

  const handleChange = (newValue: string) => {
    if (newValue.toLocaleLowerCase() === 'y') {
      setValue(newValue)
      onSubmitWarningsPrompt(true)
    }
    if (newValue.toLowerCase() === 'n') {
      setValue(newValue)
      onSubmitWarningsPrompt(false)
    }
    if (newValue === 'enter') {
      // coming from onSubmit
      setValue('N')
      onSubmitWarningsPrompt(false)
    }
  }

  return (
    <TabIndexProvider>
      <Box flexDirection="column">
        <Color bold>⚠️{'  '} There will be data loss:</Color>
        <Box marginTop={1} marginBottom={1} marginLeft={2} flexDirection="column">
          {warnings.map(warning => (
            <Box>• {warning.description}</Box>
          ))}
        </Box>
        <TextInput
          value={value}
          onChange={handleChange}
          onSubmit={() => handleChange('enter')}
          label={'Are you sure you want to apply this change? ' + chalk.dim('y/N')}
          tabIndex={0}
        />
      </Box>
    </TabIndexProvider>
  )
}
