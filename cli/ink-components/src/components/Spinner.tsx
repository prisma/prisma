import { Color } from 'ink'
import InkSpinner from 'ink-spinner'
import React from 'react'

const InkSpinnerWithoutTypes = InkSpinner as any

export const Spinner: React.FC = () => (
  <Color cyan>
    <InkSpinnerWithoutTypes />
  </Color>
)
