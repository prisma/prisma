import { absolutizeRelativePath } from '../utils/resolveDatasources'

export interface DatasourceOverwrite {
  name: string
  url: string
}

// only extract sqlite sources that don't use env vars
export function extractSqliteSources(datamodel: string, cwd: string, outputDir: string): DatasourceOverwrite[] {
  const overrides: DatasourceOverwrite[] = []
  const lines = datamodel.split('\n').filter(l => !l.trim().startsWith('//'))
  const lineRegex = /\s*url\s+=\s*"(file:[^\/].*)"/
  const startRegex = /\s*datasource\s*(\w+)\s*{/

  lines.forEach((line, index) => {
    const match = lineRegex.exec(line)
    if (match) {
      // search for open tag
      let startLine
      let searchIndex = index - 1
      while (!startLine && searchIndex >= 0) {
        const currentLine = lines[searchIndex]
        const commentIndex = currentLine.indexOf('//')
        const curlyIndex = currentLine.indexOf('{')
        if (curlyIndex > -1) {
          if (commentIndex === -1) {
            startLine = currentLine
          }
          if (commentIndex > curlyIndex) {
            startLine = currentLine
          }
        }

        searchIndex--
      }

      if (!startLine) {
        throw new Error(`Could not parse datamodel, invalid datasource block without opening \`{\``)
      }

      const startMatch = startRegex.exec(startLine)
      if (startMatch) {
        overrides.push({
          name: startMatch[1],
          url: absolutizeRelativePath(match[1], cwd, outputDir),
        })
      } else {
        throw new Error(`Could not parse datamodel, line ${searchIndex + 1}: \`${startLine}\` is not parseable`)
      }
    }
  })
  return overrides
}
