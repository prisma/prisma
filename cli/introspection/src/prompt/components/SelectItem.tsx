import { Box, Color, Text } from 'ink'
import * as React from 'react'
import { BACK_SYMBOL } from './helpers'
import { Spinner } from './Spinner'
import { SpinnerState } from '../types'
import { useStdin } from '../useStdin'
import figures = require('figures')

interface Props {
  label: string
  spinnerState?: SpinnerState | undefined
  value?: any
  focus: boolean
  description?: string
  isBackButton?: boolean
  onSelect: (value?: any) => void
  padding?: number
}

export const SelectIndicator: React.FC<{
  spinnerState?: SpinnerState | undefined
  isBackButton?: boolean
  color?: any
}> = ({ isBackButton, spinnerState }) => {
  if (isBackButton) {
    return <>{BACK_SYMBOL}</>
  }

  if (spinnerState && spinnerState.state === 'running') {
    return <Spinner />
  }

  return <>{figures.pointer}</>
}

SelectIndicator.defaultProps = {
  isBackButton: false,
  spinnerState: undefined,
}

export const Description: React.FC<Props> = ({ spinnerState, description }) => {
  if (spinnerState && spinnerState.message) {
    if (spinnerState.state === 'running' || spinnerState.state === 'succeeded') {
      return <Color green>{spinnerState.message}</Color>
    } else if (spinnerState.state === 'failed') {
      return <Color red>{spinnerState.message}</Color>
    }
  } else {
    return <Color dim>{description || ''}</Color>
  }
  return null
}

export const SelectItem: React.FC<Props> = props => {
  useStdin(
    async ({ actionKey }) => {
      if (props.focus && actionKey === 'submit') {
        await props.onSelect(props.value)
      }
    },
    [props.focus, props.value],
  )

  const padding = props.padding || 20

  const textColor = props.focus ? 'cyan' : 'visible'
  return (
    <Box>
      <Color {...{ [textColor]: true }}>
        <Box width={14} marginRight={2}>
          {props.focus ? <SelectIndicator spinnerState={props.spinnerState} isBackButton={props.isBackButton!} /> : ' '}{' '}
          <Text {...{ bold: props.focus }}>{props.label.padEnd(padding)}</Text>
        </Box>
        <Color dim>
          <Description {...props} />
        </Color>
      </Color>
    </Box>
  )
}

SelectItem.defaultProps = {
  isBackButton: false,
}
