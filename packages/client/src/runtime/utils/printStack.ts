import chalk from 'chalk'
import * as stackTraceParser from 'stacktrace-parser'

import { highlightTS } from '../highlight/highlight'
import { dedent } from './dedent'

function renderN(n: number, max: number): string {
  const wantedLetters = String(max).length
  const hasLetters = String(n).length
  if (hasLetters >= wantedLetters) {
    return String(n)
  }

  return ' '.repeat(wantedLetters - hasLetters) + n
}

export interface ErrorArgs {
  callsite?: string
  originalMethod: string
  onUs?: boolean // is this on us or is it a user error?
  showColors?: boolean
  renderPathRelative?: boolean
  printFullStack?: boolean
  isValidationError?: boolean
}

export interface PrintStackResult {
  stack: string
  indent: number
  lastErrorHeight: number
  afterLines: string
}

function getIndent(line: string): number {
  let spaceCount = 0
  for (let i = 0; i < line.length; i++) {
    if (line.charAt(i) !== ' ') {
      return spaceCount
    }
    spaceCount++
  }

  return spaceCount
}

type StackParams = {
  callsiteStr: string
  prevLines: string
  functionName: string
  afterLines: string
  indentValue: number
  lastErrorHeight: number
}

function parseStack({
  callsite,
  renderPathRelative,
  originalMethod,
  onUs,
  showColors,
  isValidationError,
}: ErrorArgs): StackParams {
  const params = {
    callsiteStr: ':',
    prevLines: '\n',
    functionName: `prisma.${originalMethod}()`,
    afterLines: '',
    indentValue: 0,
    lastErrorHeight: 20,
  }
  // @ts-ignore
  if (!callsite || typeof window !== 'undefined') {
    return params
  }

  const stack = stackTraceParser.parse(callsite)
  // TODO: more resilient logic to check that it's not relative to cwd
  const trace = stack.find((t) => {
    console.log({ file: t.file, methodName: t.methodName })
    // Here we are trying to find the location in the users code which caused the error
    return (
      t.file &&
      t.file !== '<anonymous>' && // Ignore as we can not read an <anonymous> file
      !t.file.includes('@prisma') &&
      !t.file.includes('getPrismaClient') &&
      !t.file.startsWith('internal/') && // We don't want internal nodejs files
      !t.methodName.includes('new ') &&
      !t.methodName.includes('getCallSite') &&
      !t.methodName.includes('Proxy.') &&
      t.methodName.split('.').length < 4
    )
  })

  console.log({ trace })

  if (process.env.NODE_ENV !== 'production' && trace && trace.file && trace.lineNumber && trace.column) {
    const lineNumber = trace.lineNumber
    const printedFileName = renderPathRelative ? require('path').relative(process.cwd(), trace.file) : trace.file
    const start = Math.max(0, lineNumber - 4)

    const fs = require('fs')
    const exists = fs.existsSync(trace.file)
    if (exists) {
      const file = fs.readFileSync(trace.file, 'utf-8')
      const slicedFile = file
        .split('\n')
        .slice(start, lineNumber)
        .map((line) => {
          if (line.endsWith('\r')) {
            // Strip trailing \r characters in case the original file has Windows line endings.
            // Otherwise the calculations in string manipulations below are off by one, leading
            // to inconsistent results.
            return line.slice(0, -1)
          }
          return line
        })
        .join('\n')
      const lines = dedent(slicedFile).split('\n')

      const theLine = lines[lines.length - 1]
      console.log({ theLine })
      if (!theLine || theLine.trim() === '') {
        params.callsiteStr = ':'
      } else {
        // Why even all this effort? Because if a user calls the client instance "db", we want to be able to also say "db.user.findMany"
        const prismaClientRegex =
          /(\S+(create|createMany|updateMany|deleteMany|update|delete|findMany|findUnique|findFirst|findUniqueOrThrow|findFirstOrThrow)\()/
        const match = prismaClientRegex.exec(theLine)
        if (!match) {
          return params
        }
        params.functionName = `${match[1]})`
        // only add this, if the line matches
        params.callsiteStr = ` in\n${chalk.underline(`${printedFileName}:${trace.lineNumber}:${trace.column}`)}`
        const slicePoint = theLine.indexOf('{')
        const linesToHighlight = lines
          .map((l, i, all) =>
            !onUs && i === all.length - 1 ? l.slice(0, slicePoint > -1 ? slicePoint : l.length - 1) : l,
          )
          .join('\n')

        const highlightedLines = showColors ? highlightTS(linesToHighlight).split('\n') : linesToHighlight.split('\n')

        params.prevLines =
          '\n' +
          highlightedLines
            .map((l, i) => chalk.grey(renderN(i + start + 1, lineNumber + start + 1) + ' ') + chalk.reset() + l)
            .map((l, i, arr) => (i === arr.length - 1 ? `${chalk.red.bold('→')} ${chalk.dim(l)}` : chalk.dim('  ' + l)))
            .join('\n')
        if (!match && !isValidationError) {
          params.prevLines += '\n\n'
        }
        params.afterLines = ')'
        params.indentValue = String(lineNumber + start + 1).length + getIndent(theLine) + 1 + (match ? 2 : 0)
      }
    }
  }
  return params
}

export const printStack = (args: ErrorArgs): PrintStackResult => {
  const { callsiteStr, prevLines, functionName, afterLines, indentValue, lastErrorHeight } = parseStack(args)

  const introText = args.onUs
    ? chalk.red(`Oops, an unknown error occured! This is ${chalk.bold('on us')}, you did nothing wrong.
It occured in the ${chalk.bold(`\`${functionName}\``)} invocation${callsiteStr}`)
    : chalk.red(`Invalid ${chalk.bold(`\`${functionName}\``)} invocation${callsiteStr}`)

  const stackStr = `\n${introText}
${prevLines}${chalk.reset()}`

  return { indent: indentValue, stack: stackStr, afterLines, lastErrorHeight }
}
