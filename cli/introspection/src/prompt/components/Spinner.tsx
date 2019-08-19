import { Color } from 'ink'
import InkSpinner from 'ink-spinner'
import * as React from 'react'
import { COLORS } from '../colors'

const InkSpinnerWithoutTypes = InkSpinner as any

export const Spinner: React.FC = () => (
  <Color keyword={COLORS.selection}>
    <InkSpinnerWithoutTypes />
  </Color>
)
