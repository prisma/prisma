import chalk from 'chalk'
import * as stackTraceParser from 'stacktrace-parser'
import { highlightTS } from '../highlight/highlight'
import { dedent } from '../utils/dedent'

function renderN(n: number, max: number): string {
  const wantedLetters = String(max).length
  const hasLetters = String(n).length
  if (hasLetters >= wantedLetters) {
    return String(n)
  }

  return String(' '.repeat(wantedLetters - hasLetters) + n)
}

export interface ErrorArgs {
  callsite?: string
  originalMethod: string
  onUs?: boolean // is this on us?
}

export interface PrintStackResult {
  stack: string
  indent: number
  lastErrorHeight: number
  afterLines: string
}

export const printStack = ({ callsite, originalMethod, onUs }: ErrorArgs): PrintStackResult => {
  const lastErrorHeight = 20
  let callsiteStr = ':'
  let prevLines = '\n'
  let afterLines = ''
  let indentValue = 0
  let functionName = `photon.${originalMethod}()`

  // @ts-ignore
  if (callsite && typeof window === 'undefined') {
    const stack = stackTraceParser.parse(callsite)
    // TODO: more resilient logic to check that it's not relative to cwd
    const trace = stack.find(
      t =>
        t.file &&
        !t.file.includes('@generated') &&
        !t.methodName.includes('new ') &&
        t.methodName.split('.').length < 4,
    )
    if (process.env.NODE_ENV !== 'production' && trace && trace.file && trace.lineNumber && trace.column) {
      const fileName = trace.file
      const lineNumber = trace.lineNumber
      callsiteStr = callsite ? ` in ${chalk.underline(`${trace.file}:${trace.lineNumber}:${trace.column}`)}` : ''
      const height = process.stdout.rows || 20
      const start = Math.max(0, lineNumber - 5)
      const neededHeight = lastErrorHeight + lineNumber - start
      if (height > neededHeight) {
        const fs = require('fs')
        if (fs.existsSync(fileName)) {
          const file = fs.readFileSync(fileName, 'utf-8')
          const slicedFile = file
            .split('\n')
            .slice(start, lineNumber)
            .join('\n')
          const lines = dedent(slicedFile).split('\n')

          const theLine = lines[lines.length - 1]
          const photonRegex = /(=|return)+\s+(await)?\s*(.*\()/
          const match = theLine.match(photonRegex)
          if (match) {
            functionName = `${match[3]})`
          }
          const slicePoint = theLine.indexOf('{')
          const highlightedLines = highlightTS(
            lines
              .map((l, i, all) =>
                !onUs && i === all.length - 1 ? l.slice(0, slicePoint > -1 ? slicePoint : l.length - 1) : l,
              )
              .join('\n'),
          ).split('\n')
          prevLines =
            '\n' +
            highlightedLines
              .map((l, i) => chalk.grey(renderN(i + start + 1, lineNumber + start + 1) + ' ') + chalk.reset() + l)
              .map((l, i, arr) => (i === arr.length - 1 ? `${chalk.red.bold('→')} ${l}` : chalk.dim('  ' + l)))
              .join('\n')
          afterLines = ')'
          indentValue = String(lineNumber + start + 1).length + getIndent(theLine) + 1
        }
      }
    }
  }

  function getIndent(line: string) {
    let spaceCount = 0
    for (let i = 0; i < line.length; i++) {
      if (line.charAt(i) !== ' ') {
        return spaceCount
      }
      spaceCount++
    }

    return spaceCount
  }

  const introText = onUs
    ? chalk.red(`Oops, an unknown error occured! This is ${chalk.bold('on us')}, you did nothing wrong.
It occured in the ${chalk.bold(`\`${functionName}\``)} invocation${callsiteStr}`)
    : chalk.red(`Invalid ${chalk.bold(`\`${functionName}\``)} invocation${callsiteStr}`)

  const stackStr = `\n${introText}
${prevLines}${chalk.reset()}`
  return { indent: indentValue, stack: stackStr, afterLines, lastErrorHeight }
}
