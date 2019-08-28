import { Box, Color, Text } from 'ink'
import React from 'react'
import stripAnsi from 'strip-ansi'
import { COLORS } from '../colors'
import { Checkbox } from './inputs/Checkbox'
import { Divider } from './Divider'
import {
  ActionKey,
  down,
  isElementCheckbox,
  isElementInput,
  isElementRadio,
  isElementSelect,
  isElementSeparator,
  up,
} from './helpers'
import { RadioButton } from './RadioButton'
import { TextInput } from './inputs/TextInput'
import { CheckboxElement, InputElement, PromptElement, RadioElement, SpinnerState } from '../old-types'
import { useStdin } from '../useStdin'
import { Key } from 'readline'

export interface OnSubmitParams {
  formValues?: Record<string, any>
  selectedValue?: any
  goBack: boolean
  startSpinner: (message?: string) => void
  stopSpinner: (state: SpinnerState) => void
}

export interface onFormChangedParams {
  values: Record<string, any>
  triggeredInput: InputElement | CheckboxElement | RadioElement
}

interface Props {
  elements: PromptElement[]
  title?: string
  subtitle?: string
  onSubmit: (params: OnSubmitParams) => void
  onFormChanged?: (params: onFormChangedParams) => void
  formValues: Record<string, any>
  withBackButton: false | { label: string; description?: string }
}

export type KeyPressed = {
  key: ActionKey
  str: string
}

export const Prompt: React.FC<Props> = props => {
  const [spinnersByCursor, setSpinnerByCursor] = React.useState<Record<string, SpinnerState | undefined>>({})
  const [cursor, setCursor] = React.useState(0)
  const [lastKeyPressed, setLastKeyPressed] = React.useState<KeyPressed>({ key: false, str: '' })
  const elementsWithBack: PromptElement[] = props.withBackButton
    ? [
        ...props.elements,
        {
          label: 'Back',
          style: { marginTop: 1 },
          type: 'select',
          value: undefined,
        },
      ]
    : props.elements

  useStdin(
    ({ actionKey, text }) => {
      setCursor(prevCursor => {
        if (actionKey === 'up') {
          return up(prevCursor, elementsWithBack)
        }

        if (actionKey === 'down') {
          return down(prevCursor, elementsWithBack)
        }

        const hoveredElement = elementsWithBack[prevCursor]

        if (actionKey === 'next') {
          return down(prevCursor, elementsWithBack)
        }

        if (actionKey === 'submit' && isElementInput(hoveredElement)) {
          return down(prevCursor, elementsWithBack)
        }

        return prevCursor
      })

      setLastKeyPressed({ key: actionKey, str: stripAnsi(text) })
    },
    [cursor, elementsWithBack],
  )

  const onInputChange = (value: string | boolean, input: InputElement | CheckboxElement | RadioElement) => {
    const newFormValues = {
      ...props.formValues,
      [input.identifier]: value,
    }

    if (props.onFormChanged) {
      props.onFormChanged({ values: newFormValues, triggeredInput: input })
    }

    setLastKeyPressed({ key: false, str: '' })
  }

  const addSpinner = (spinnerCursor: number) => {
    return (message?: string) => {
      setSpinnerByCursor(prev => ({
        ...prev,
        [spinnerCursor]: { state: 'running', message },
      }))
    }
  }

  const removeSpinner = (spinnerCursor: number) => {
    return (state: Exclude<SpinnerState, 'running'>) => {
      setSpinnerByCursor(prev => ({ ...prev, [spinnerCursor]: state }))
    }
  }

  const submitPrompt = (value: any, goBack: boolean, elemIndex: number) => {
    props.onSubmit({
      formValues: props.formValues,
      selectedValue: value,
      goBack,
      startSpinner: addSpinner(elemIndex),
      stopSpinner: removeSpinner(elemIndex),
    })
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {props.title && (
        <Box flexDirection="column" marginBottom={1} marginLeft={1}>
          <Box flexDirection="column">
            <Text bold>{props.title}</Text>
            {props.subtitle && <Color dim>{'\n' + props.subtitle}</Color>}
          </Box>
          <Divider />
        </Box>
      )}
      <Box flexDirection="column">
        {props.elements.map((e, elemIndex) => {
          const hasFocus = cursor === elemIndex

          if (isElementInput(e)) {
            return (
              <Box key={elemIndex} {...e.style}>
                <TextInput
                  {...e}
                  value={(props.formValues[e.identifier] && props.formValues[e.identifier].toString()) || ''}
                  onChange={value => onInputChange(value, e)}
                  tabIndex={elemIndex}
                />
              </Box>
            )
          }

          if (isElementCheckbox(e)) {
            return (
              <Box key={elemIndex} {...e.style}>
                <Checkbox
                  {...e}
                  checked={props.formValues[e.identifier] || false}
                  onChange={value => onInputChange(value, e)}
                  tabIndex={123}
                />
              </Box>
            )
          }

          if (isElementRadio(e)) {
            const checked = props.formValues[e.identifier] === e.value

            return (
              <Box key={elemIndex} {...e.style}>
                <RadioButton
                  label={e.label}
                  value={e.value}
                  checked={checked}
                  description={e.description}
                  onChange={value => onInputChange(value, e)}
                  tabIndex={54}
                />
              </Box>
            )
          }

          if (isElementSeparator(e)) {
            return (
              <Box key={elemIndex} {...e.style}>
                <Divider title={e.label} dividerChar={e.dividerChar} />
              </Box>
            )
          }

          if (isElementSelect(e)) {
            return <Box key={elemIndex} {...e.style} />
          }
          return null
        })}
      </Box>
    </Box>
  )
}
