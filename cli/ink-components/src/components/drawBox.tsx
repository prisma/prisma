import chalk from 'chalk'
import cliTruncate from 'cli-truncate'
import stringWidth from 'string-width'

export type BoxOptions = {
  title: string
  width: number
  height: number
  str: string
  drawExtension?: boolean
}

const defaultChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomRight: '┘',
  bottomLeft: '└',
  vertical: '│',
  horizontal: '─',
}

export function drawBox({ title, width, height, str, drawExtension }: BoxOptions) {
  const chars = { ...defaultChars }

  if (drawExtension) {
    chars.topLeft = '├'
    chars.topRight = '┤'
  }

  title = title || ''
  const topLine =
    chalk.grey(chars.topLeft + chars.horizontal) +
    (title ? ' ' : '') +
    chalk.reset(title) +
    (title ? ' ' : '') +
    chalk.grey(chars.horizontal.repeat(width - stringWidth(title) - (title ? 2 : 0) - 3) + chars.topRight) +
    chalk.reset()

  const bottomLine = chars.bottomLeft + chars.horizontal.repeat(width - 2) + chars.bottomRight

  const lines = str.split('\n')

  if (lines.length < height) {
    lines.push(...new Array(height - lines.length).fill(''))
  }

  const mappedLines = lines
    .slice(-height)
    .map(l => {
      const lineWidth = Math.min(stringWidth(l || ''), width)
      const paddingRight = Math.max(width - lineWidth - 2, 0)
      return `${chalk.grey(chars.vertical)}${chalk.reset(cliTruncate(l, width - 2))}${' '.repeat(
        paddingRight,
      )}${chalk.grey(chars.vertical)}`
    })
    .join('\n')

  return chalk.grey(topLine + '\n' + mappedLines + '\n' + bottomLine)
}
