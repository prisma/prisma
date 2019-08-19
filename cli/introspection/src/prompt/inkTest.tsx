import { render, Color, Box, Text } from 'ink'
import React from 'react'
import { Progress } from './components/Progress'
import BorderBox from './components/BorderBox'
import chalk from 'chalk'
import Step0StarterVsBlank from './steps/Step0StarterVsBlank'

class Compy extends React.Component<any, { step: number; progress: number }> {
  state = {
    step: 0,
    progress: 0,
  }
  componentDidMount() {
    setInterval(() => {
      this.setState(({ step }) => {
        step += 0.05

        return {
          step,
          progress: Math.abs(Math.sin(step)),
        }
      })
    }, 16)
  }
  render() {
    return (
      <BorderBox flexDirection="column" title={chalk.bold('Hello World ' + Math.round(this.state.progress * 100))}>
        <Progress progress={this.state.progress} />
      </BorderBox>
    )
  }
}

export function renderInk() {
  return new Promise(resolve => {
    render(<Step0StarterVsBlank onSubmit={resolve} />)
  })
}
