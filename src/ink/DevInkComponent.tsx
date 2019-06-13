import React, { Component } from 'react'
import { render, Color, Box, StdoutContext, StdinContext } from 'ink'
import Link from 'ink-link'
import supportsHyperlinks from 'supports-hyperlinks'
import cliCursor from 'cli-cursor'
import Spinner from 'ink-spinner'
import { formatms } from '../utils/formartms'
import { printDatamodelDiff } from '../utils/printDatamodelDiff'
import { missingGeneratorMessage } from '../utils/missingGeneratorMessage'
import { renderDate } from '../utils/now'

export type GeneratorInfo = {
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
  error?: string
}

export interface Props extends DevComponentProps {
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  setRawMode: ((mode: boolean) => void) | undefined
}

export type State = {
  showDiff: boolean
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
  lastHeight = process.stdout.rows
  lastWidth = process.stdout.columns
  resizeInterval: any
  state = {
    showDiff: false,
  }
  get width() {
    return Math.min(this.props.stdout.columns || 64, 120) - 4
  }
  get height() {
    return Math.min(this.props.stdout.rows || 19, 120) - 2
  }
  componentDidMount() {
    cliCursor.hide()
    this.resizeInterval = setInterval(() => {
      if (this.props.stdout.rows !== this.lastHeight || this.props.stdout.columns !== this.lastWidth) {
        this.forceUpdate()
      }
    }, 100)
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

      if (this.state.showDiff && (key === ENTER || key === BACKSPACE || key === DELETE)) {
        this.setState({ showDiff: false })
      }
    })
    if (this.props.setRawMode) {
      this.props.setRawMode(true)
    }
  }
  componentWillUnmount() {
    cliCursor.show()
    clearInterval(this.resizeInterval)
    if (this.props.setRawMode) {
      this.props.setRawMode(false)
    }
  }

  render() {
    const { generators, datamodelBefore, datamodelAfter } = this.props
    this.lastHeight = this.props.stdout.rows
    this.lastWidth = this.props.stdout.columns
    if (this.state.showDiff) {
      const diff = printDatamodelDiff(datamodelBefore, datamodelAfter)
      return (
        <Box flexDirection="column" marginTop={1} alignItems="flex-start" justifyContent="flex-start">
          <Box>
            <Color>
              Changes in datamodel since last <Color bold>prisma lift save</Color>
            </Color>
          </Box>
          <Box marginTop={1} marginBottom={1}>
            {diff.trim() === '' ? `No unsaved changes` : diff}
          </Box>
          <Color gray>{'─'.repeat(this.width)}</Color>
          <Box>
            <Box>
              <Color bold>b: </Color>
              <Color grey>back</Color>
            </Box>
          </Box>
        </Box>
      )
    }
    if (this.props.error) {
      return (
        <Box flexDirection="column">
          <Color bold redBright>
            Error
          </Color>
          <Color>{this.props.error}</Color>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" marginTop={1} marginLeft={1} height={this.height} justifyContent="space-between">
        <Box flexDirection="column">
          <Box marginLeft={2} flexDirection="column">
            <Color bold>Watching for changes in project.prisma</Color>
            {this.props.lastChanged ? (
              <Color gray>Last changed at {renderDate(this.props.lastChanged)}</Color>
            ) : (
              <Color />
            )}
            <Box marginTop={2} flexDirection="column">
              <Color bold>Generator</Color>
              <Color gray>{'─'.repeat(this.width)}</Color>
            </Box>
          </Box>
          <Box marginTop={0}>
            {generators.length === 0 ? (
              missingGeneratorMessage
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
                      <Color grey key={gen.name}>
                        Generating...
                      </Color>
                    ) : gen.generatedIn ? (
                      <Color grey key={gen.name}>
                        generated in {formatms(gen.generatedIn)}
                      </Color>
                    ) : (
                      <Color grey key={gen.name}>
                        not yet generated
                      </Color>
                    ),
                  )}
                </Box>
              </>
            )}
          </Box>
          <Box marginLeft={2} flexDirection="column">
            <Box marginTop={2} flexDirection="column">
              <Color bold>Migrations</Color>
              <Color gray>{'─'.repeat(this.width)}</Color>
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
              <Color gray>
                To save changes into a migration file, run{' '}
                <Color bold dim green>
                  prisma lift save
                </Color>
              </Color>
            </Box>
          </Box>
        </Box>
        <Box flexDirection="column" marginLeft={2} marginTop={2}>
          <Box marginTop={1} width={this.width} justifyContent="space-between">
            <Box>
              <Color bold>Studio endpoint: </Color>
              {supportsHyperlinks.stdout ? (
                <Link url={'http://localhost:5555/'}>http://localhost:5555/</Link>
              ) : (
                <Color underline>http://localhost:5555/</Color>
              )}
            </Box>
          </Box>
          <Color gray>{'─'.repeat(this.width)}</Color>
          <Box>
            <Box>
              <Color bold>d: </Color>
              <Color grey>diff</Color>
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
