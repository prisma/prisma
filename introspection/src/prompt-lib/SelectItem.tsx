import { Box, Color, ColorProps } from 'ink'
import * as React from 'react'
import { COLORS } from '../colors'
import { BACK_SYMBOL } from './helpers'
import { Spinner } from './Spinner'
import { SpinnerState } from './types'
import { useStdin } from './useStdin'
import figures = require('figures')

interface Props {
  label: string
  spinnerState: SpinnerState | undefined
  value?: any
  focus: boolean
  description?: string
  isBackButton?: boolean
  onSelect: (value?: any) => void
}

function renderSelectIndicator(spinnerState: SpinnerState | undefined, isBackButton: boolean) {
  if (isBackButton) {
    return BACK_SYMBOL
  }

  if (spinnerState && spinnerState.state === 'running') {
    return <Spinner />
  }

  return figures.pointer
}

export const SelectIndicator: React.FC<{
  spinnerState?: SpinnerState | undefined
  isBackButton?: boolean
  color?: ColorProps
}> = props => (
  <Box marginRight={1}>
    <Color {...props.color}>{renderSelectIndicator(props.spinnerState, props.isBackButton!)}</Color>
  </Box>
)

function renderDescription(props: Props) {
  if (props.spinnerState && props.spinnerState.message) {
    if (props.spinnerState.state === 'running' || props.spinnerState.state === 'succeeded') {
      return <Color green>{props.spinnerState.message}</Color>
    } else if (props.spinnerState.state === 'failed') {
      return <Color red>{props.spinnerState.message}</Color>
    }
  } else {
    return <Color dim>{props.description || ''}</Color>
  }
}

SelectIndicator.defaultProps = {
  isBackButton: false,
  spinnerState: undefined,
}

export const SelectItem: React.FC<Props> = props => {
  const indicator = (
    <SelectIndicator
      color={props.focus ? { [COLORS.selection]: true } : {}}
      spinnerState={props.spinnerState}
      isBackButton={props.isBackButton!}
    />
  )

  useStdin(
    async actionKey => {
      if (props.focus && actionKey === 'submit') {
        await props.onSelect(props.value)
      }
    },
    [props.focus, props.value],
  )

  return (
    <Box>
      {props.focus ? <Color keyword={COLORS.selection}>{indicator}</Color> : indicator}
      <Box marginLeft={1}>
        {props.focus ? <Color keyword={COLORS.selection}>{props.label.padEnd(20)}</Color> : props.label.padEnd(20)}
      </Box>
      {renderDescription(props)}
    </Box>
  )
}

SelectItem.defaultProps = {
  isBackButton: false,
}
