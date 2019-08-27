import React from 'react'
import { Box, Color } from 'ink'
import Spinner from 'ink-spinner'

const AnySpinner = Spinner as any

export interface Props {
  steps: string[]
  activeIndex: number
}

const DownloadProgress: React.FC<Props> = ({ steps, activeIndex }) => (
  <Box flexDirection="column">
    {steps.map((step, index) => (
      <Color dim={index > activeIndex} green={index < activeIndex} key={step}>
        {index < activeIndex ? '✔' : index === activeIndex ? <AnySpinner type="dots" /> : `${index + 1}`}
        {'  '}
        {step}
        {' ...'}
      </Color>
    ))}
  </Box>
)

export default DownloadProgress
