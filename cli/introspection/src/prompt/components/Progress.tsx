import React from 'react'
import { Color, Box, Text } from 'ink'
import ProgressBar from 'ink-progress-bar'

export interface Props {
  progress: number // progress from 0 to 1
}

const width = 40

export function Progress(props: Props) {
  const { progress } = props
  const percentage = Math.round(progress * 100)
  return (
    <Color green>
      <Box marginLeft={1} marginRight={1}>
        <Text bold>{percentage}%</Text>
      </Box>
      <ProgressBar percent={progress} columns={width} />
      <Color dim>
        <ProgressBar percent={1 - progress} columns={width} character="░" />
      </Color>
    </Color>
  )
}
