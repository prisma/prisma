import { DMMF } from '@prisma/generator-helper'
import chalk from 'chalk'
import indentString from 'indent-string'

import { CallSite, LocationInFile } from './CallSite'
import { SourceFileSlice } from './SourceFileSlice'

export interface ErrorArgs {
  callsite?: CallSite
  originalMethod: string
  message: string
  isPanic?: boolean
  showColors?: boolean
  callArguments?: string
}

type Colors = {
  red: (str: string) => string
  gray: (str: string) => string
  dim: (str: string) => string
  bold: (str: string) => string
  underline: (str: string) => string
  highlightSource: (source: SourceFileSlice) => SourceFileSlice
}

const colorsEnabled: Colors = {
  red: (str) => chalk.red(str),
  gray: (str) => chalk.gray(str),
  dim: (str) => chalk.dim(str),
  bold: (str) => chalk.bold(str),
  underline: (str) => chalk.underline(str),
  highlightSource: (source) => source.highlight(),
}

const colorsDisabled: Colors = {
  red: (str) => str,
  gray: (str) => str,
  dim: (str) => str,
  bold: (str) => str,
  underline: (str) => str,
  highlightSource: (source) => source,
}

type ErrorContextTemplateParameters = {
  functionName: string
  message: string
  location?: LocationInFile
  contextLines?: SourceFileSlice
  callArguments?: string
  isPanic: boolean
}

function getTemplateParameters(
  { callsite, message, originalMethod, isPanic, callArguments }: ErrorArgs,
  colors: Colors,
): ErrorContextTemplateParameters {
  const templateParameters: ErrorContextTemplateParameters = {
    functionName: `prisma.${originalMethod}()`,
    message,
    isPanic: isPanic ?? false,
    callArguments,
  }
  // @ts-ignore
  if (!callsite || typeof window !== 'undefined') {
    return templateParameters
  }

  if (process.env.NODE_ENV === 'production') {
    return templateParameters
  }

  const callLocation = callsite.getLocation()
  if (!callLocation || !callLocation.lineNumber || !callLocation.columnNumber) {
    return templateParameters
  }

  const contextFirstLine = Math.max(1, callLocation.lineNumber - 3)
  let source = SourceFileSlice.read(callLocation.fileName)?.slice(contextFirstLine, callLocation.lineNumber)
  const invocationLine = source?.lineAt(callLocation.lineNumber)
  if (source && invocationLine) {
    const invocationLineIndent = getIndent(invocationLine)
    const invocationCallCode = findPrismaActionCall(invocationLine)
    if (!invocationCallCode) {
      return templateParameters
    }
    templateParameters.functionName = `${invocationCallCode.code})`
    templateParameters.location = callLocation

    if (!isPanic) {
      source = source.mapLineAt(callLocation.lineNumber, (line) => line.slice(0, invocationCallCode.openingBraceIndex))
    }

    source = colors.highlightSource(source)
    const numberColumnWidth = String(source.lastLineNumber).length
    templateParameters.contextLines = source
      .mapLines((line, lineNumber) => colors.gray(String(lineNumber).padStart(numberColumnWidth)) + ' ' + line)
      .mapLines((line) => colors.dim(line))
      .prependSymbolAt(callLocation.lineNumber, colors.bold(colors.red('→')))

    if (callArguments) {
      let indentValue = invocationLineIndent + numberColumnWidth + 1 /* space between number and code */
      indentValue += 2 // arrow + space between arrow and number

      // indent all lines but first, because first line of the arguments will be printed
      // on the same line as the function call
      templateParameters.callArguments = indentString(callArguments, indentValue).slice(indentValue)
    }
  }
  return templateParameters
}

function findPrismaActionCall(str: string): { code: string; openingBraceIndex: number } | null {
  const allActions = Object.keys(DMMF.ModelAction).join('|')
  const regexp = new RegExp(String.raw`\S+(${allActions})\(`)
  const match = regexp.exec(str)
  if (match) {
    return {
      code: match[0],
      openingBraceIndex: match.index + match[0].length,
    }
  }
  return null
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

function stringifyErrorMessage(
  { functionName, location, message, isPanic, contextLines, callArguments }: ErrorContextTemplateParameters,
  colors: Colors,
) {
  const lines: string[] = ['']

  const introSuffix = location ? ' in' : ':'
  if (isPanic) {
    lines.push(colors.red(`Oops, an unknown error occurred! This is ${colors.bold('on us')}, you did nothing wrong.`))
    lines.push(colors.red(`It occurred in the ${colors.bold(`\`${functionName}\``)} invocation${introSuffix}`))
  } else {
    lines.push(colors.red(`Invalid ${colors.bold(`\`${functionName}\``)} invocation${introSuffix}`))
  }

  if (location) {
    lines.push(colors.underline(stringifyLocationInFile(location)))
  }

  if (contextLines) {
    lines.push('')

    const contextLineParts = [contextLines.toString()]

    if (callArguments) {
      contextLineParts.push(callArguments)
      contextLineParts.push(colors.dim(')'))
    }
    lines.push(contextLineParts.join(''))
    if (callArguments) {
      lines.push('')
    }
  } else {
    lines.push('')
    if (callArguments) {
      lines.push(callArguments)
    }
    lines.push('')
  }

  lines.push(message)
  return lines.join('\n')
}

function stringifyLocationInFile(location: LocationInFile): string {
  const parts = [location.fileName]
  if (location.lineNumber) {
    parts.push(String(location.lineNumber))
  }

  if (location.columnNumber) {
    parts.push(String(location.columnNumber))
  }

  return parts.join(':')
}

export function createErrorMessageWithContext(args: ErrorArgs): string {
  const colors = args.showColors ? colorsEnabled : colorsDisabled
  const templateParameters = getTemplateParameters(args, colors)
  return stringifyErrorMessage(templateParameters, colors)
}
