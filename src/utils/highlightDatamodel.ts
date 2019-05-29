import chalk from 'chalk'

interface Replacement {
  start: number
  end: number
  replacement: string
}
// TODO: Use reduceright instead
export function highlightDatamodel(datamodel: string): string {
  const { replacements } = syntax.reduce<{
    datamodel: string
    replacements: Replacement[]
  }>(
    ({ datamodel, replacements }, curr) => {
      let result: RegExpExecArray | null = null
      while ((result = curr.regex.exec(datamodel)) !== null) {
        const match = result[1] || result[0]
        const index = result[0].indexOf(match) + result.index
        replacements.push({
          start: index,
          end: index + match.length,
          replacement: curr.color(match),
        })
      }

      return {
        datamodel,
        replacements,
      }
    },
    { datamodel, replacements: [] },
  )

  replacements.sort((a, b) => (a.start < b.start ? -1 : 1))

  return replacements.reduce<{ datamodel: string; currentOffset: number }>(
    ({ datamodel, currentOffset }, { start, end, replacement }) => {
      const newDatamodel =
        datamodel.slice(0, start + currentOffset) +
        replacement +
        datamodel.slice(end + currentOffset)

      return {
        datamodel: newDatamodel,
        currentOffset: currentOffset + (replacement.length - (end - start)),
      }
    },
    { datamodel, currentOffset: 0 },
  ).datamodel
}

const darkBrightBlue = chalk.rgb(107, 139, 140)
const blue = chalk.rgb(24, 109, 178)
const brightBlue = chalk.rgb(127, 155, 155)

type Highlight = {
  regex: RegExp
  color: (str: string) => string
}

const syntax: Highlight[] = [
  {
    regex: /(\:|}|{)/g,
    color: darkBrightBlue,
  },
  {
    regex: /model\s+\w+/g,
    color: blue,
  },
  {
    regex: /\:\s+(\w+)/g,
    color: brightBlue,
    // color: chalk.red,
  },
  {
    regex: /\:\s+\w+\s(@.*)/g,
    color: blue,
  },
]
