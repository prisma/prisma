import cliCursor from 'cli-cursor'
import memoize from 'fast-memoize'
import { Box, Color, StdinContext, StdoutContext } from 'ink'
import Link from 'ink-link'
import React, { Component } from 'react'
import stripAnsi from 'strip-ansi'
import supportsHyperlinks from 'supports-hyperlinks'
import { formatms } from '../utils/formartms'
import { missingGeneratorMessage } from '../utils/generation/missingGeneratorMessage'
import { renderDate } from '../utils/now'
import { printDatamodelDiff } from '../utils/printDatamodelDiff'
import { Spinner } from './Spinner'

export interface GeneratorInfo {
  name: string
  generatedIn: number | undefined
  generating: boolean
}

export interface DevComponentProps {
  datamodelBefore: string
  datamodelAfter: string
  migrating: boolean
  migratedIn: number | undefined
  generators: GeneratorInfo[]
  lastChanged: Date | undefined
  error?: Error
  datamodelPath: string
  studioPort: number
  relativeDatamodelPath: string
}

export interface Props extends DevComponentProps {
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  setRawMode: ((mode: boolean) => void) | undefined
}

export interface State {
  showDiff: boolean
  diffScroll: number
}
// const ARROW_UP = '\u001B[A'
// const ARROW_DOWN = '\u001B[B'
const ARROW_LEFT = '\u001B[D'
const ARROW_RIGHT = '\u001B[C'
const ENTER = '\r'
// const CTRL_C = '\x03'
const BACKSPACE = '\x08'
const DELETE = '\x7F'

class DevComponent extends Component<Props, State> {
  public resizeInterval: any
  public state = {
    showDiff: false,
    diffScroll: 0,
  }
  get width() {
    return (this.props.stdout.columns || 64) - 4
  }
  get height() {
    return Math.max(Math.min(process.stdout.rows || 19, 120) - 2, 10)
  }
  get diff(): { diff: string; rowCount: number } {
    return this.getDiff()
  }
  public getDiff = memoize(() => {
    const { datamodelBefore, datamodelAfter } = this.props
    const diff = printDatamodelDiff(datamodelBefore, datamodelAfter)
    return { diff, rowCount: stripAnsi(diff).split('\n').length }
  })
  public componentDidMount() {
    cliCursor.hide()
    process.stdout.on('resize', () => {
      this.forceUpdate()
    })
    this.props.stdin.on('data', data => {
      const key = String(data)
      if (key === 'b') {
        this.setState({ showDiff: false })
      }

      if (key === 'd' || key === ARROW_LEFT || key === ARROW_RIGHT) {
        this.setState(state => ({ ...state, showDiff: !state.showDiff }))
      }

      if (this.state.showDiff) {
        if (key === ENTER || key === BACKSPACE || key === DELETE) {
          this.setState({ showDiff: false })
        }
        // TODO: Implement scrolling view
        // if (key === 'j') {
        //   const { rowCount } = this.diff
        //   const max = rowCount - 3
        //   if (this.state.diffScroll <= max) {
        //     this.setState(state => {
        //       // check 2 times to prevent unnecessary setState execution
        //       // and to prevent parallel execution
        //       return { ...state, diffScroll: Math.min(max, state.diffScroll + 1) }
        //     })
        //   }
        // }
        // if (key === 'k') {
        //   const { rowCount } = this.diff
        //   const min = -rowCount + 3
        //   if (this.state.diffScroll > min) {
        //     this.setState(state => {
        //       return { ...state, diffScroll: Math.max(min, state.diffScroll - 1) }
        //     })
        //   }
        // }
      }
    })
    if (this.props.setRawMode) {
      this.props.setRawMode(true)
    }
  }

  public componentWillUnmount() {
    cliCursor.show()
    if (this.props.setRawMode) {
      this.props.setRawMode(false)
    }
  }

  public trimmedDiff() {
    return this.diff.diff
    // const { diff, rowCount } = this.diff
    // const { diffScroll } = this.state
    // if (diffScroll === 0) {
    //   return diff
    // }
    // const lines = diff.split('\n')
    // if (diffScroll > 0) {
    //   return lines.slice(diffScroll).join('\n')
    // }
    // return lines.slice(0, rowCount + diffScroll).join('\n')
  }

  public render() {
    const { generators } = this.props
    const smallScreen = this.height <= 16
    const paddingTop = smallScreen ? 1 : 2
    if (this.state.showDiff) {
      const { diff, rowCount } = this.diff
      const height = Math.max(this.height, rowCount + 5)
      return (
        <Box flexDirection="column" marginTop={1} justifyContent="space-between" height={height}>
          <Box flexDirection="column">
            <Box>
              <Color>
                Changes in datamodel since last <Color bold>prisma lift save</Color>
              </Color>
            </Box>
            <Box marginTop={1} marginLeft={2}>
              {diff.trim() === '' ? `No unsaved changes` : this.trimmedDiff()}
            </Box>
          </Box>
          <Box flexDirection="column">
            <Color dim>{'─'.repeat(this.width)}</Color>
            <Box>
              <Box>
                <Color bold>b: </Color>
                <Color dim>back</Color>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }
    if (this.props.error) {
      const error: any = this.props.error
      let kind = ''
      let callsite: Element | undefined
      if (error.code && error.code === 1001) {
        kind = 'Datamodel Validation '
        callsite = (
          <Box marginLeft={1}>
            <Color redBright>
              in <Color underline>{this.props.datamodelPath}</Color>
            </Color>
          </Box>
        )
      }

      return (
        <Box flexDirection="column" marginTop={1} justifyContent="flex-start">
          <Box>
            <Color bold redBright>
              {kind}Error
            </Color>
            {callsite}
          </Box>
          <Box marginTop={1}>
            <Color>{this.props.error.stack}</Color>
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" marginTop={1} marginLeft={1} height={this.height} justifyContent="space-between">
        <Box flexDirection="column">
          <Box marginLeft={2} flexDirection="column">
            <Color bold>Watching for changes in {this.props.relativeDatamodelPath}</Color>
            {this.props.lastChanged ? (
              <Color dim>Last changed at {renderDate(this.props.lastChanged)}</Color>
            ) : (
              <Color dim>No changes yet</Color>
            )}
            <Box marginTop={paddingTop} flexDirection="column">
              <Color bold>Generator</Color>
              {!smallScreen && <Color dim>{'─'.repeat(this.width)}</Color>}
            </Box>
          </Box>
          <Box marginTop={0} marginLeft={0}>
            {generators.length === 0 ? (
              <Box height={missingGeneratorMessage.split('\n').length} marginLeft={4}>
                {missingGeneratorMessage}
              </Box>
            ) : (
              <>
                <Box flexDirection="column">
                  {generators.map(gen =>
                    gen.generating ? (
                      <Color yellow key={gen.name}>
                        <Spinner type="dots10" /> {gen.name}
                      </Color>
                    ) : (
                      <Color green key={gen.name}>
                        ✓ {gen.name}
                      </Color>
                    ),
                  )}
                </Box>
                <Box flexDirection="column" marginLeft={4}>
                  {generators.map(gen =>
                    gen.generating ? (
                      <Color dim key={gen.name}>
                        Generating...
                      </Color>
                    ) : gen.generatedIn ? (
                      <Color dim key={gen.name}>
                        generated in {formatms(gen.generatedIn)}
                      </Color>
                    ) : (
                      <Color dim key={gen.name}>
                        not yet generated
                      </Color>
                    ),
                  )}
                </Box>
              </>
            )}
          </Box>
          <Box marginLeft={2} flexDirection="column">
            <Box marginTop={paddingTop} flexDirection="column">
              <Color bold>Migrations</Color>
              {!smallScreen && <Color dim>{'─'.repeat(this.width)}</Color>}
            </Box>
          </Box>
          <Box marginTop={0} flexDirection="column">
            {this.props.migrating ? (
              <Color yellow>
                <Spinner type="dots10" /> Migrating the database...
              </Color>
            ) : (
              <Color green>
                ✓ Database successfully migrated
                {this.props.migratedIn ? <> in {formatms(this.props.migratedIn)}</> : null}
              </Color>
            )}
            <Box marginLeft={2}>
              <Color dim>
                To save changes into a migration file, run{' '}
                <Color bold dim green>
                  prisma2 lift save
                </Color>
              </Color>
            </Box>
          </Box>
        </Box>
        <Box flexDirection="column" marginLeft={2} marginTop={0}>
          <Box marginTop={1} width={this.width} justifyContent="space-between">
            <Box>
              <Color bold>Studio endpoint: </Color>
              {supportsHyperlinks.stdout ? (
                <Link url={'http://localhost:' + this.props.studioPort}>http://localhost:{this.props.studioPort}/</Link>
              ) : (
                <Color underline>http://localhost:{this.props.studioPort}/</Color>
              )}
            </Box>
          </Box>
          <Color dim>{'─'.repeat(this.width)}</Color>
          <Box>
            <Box>
              <Color bold>d: </Color>
              <Color dim>diff</Color>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

export const DevInkComponent = (props: DevComponentProps) => (
  <StdinContext.Consumer>
    {({ stdin, setRawMode }) => (
      <StdoutContext.Consumer>
        {({ stdout }) => <DevComponent stdout={stdout} stdin={stdin} setRawMode={setRawMode} {...props} />}
      </StdoutContext.Consumer>
    )}
  </StdinContext.Consumer>
)
