import fs from 'fs/promises'

export type XColumn = 'models' | 'relations' | 'enums'

type GnuplotContentParams = {
  filePath: string
  xColumn: XColumn
  plot: { kind: 'single' } | { kind: 'comparison'; baselineTitle: string; currentTitle: string }
}

export function writeGnuplotFile(params: GnuplotContentParams) {
  return fs.writeFile(params.filePath, getGnuplotContent(params))
}

function getGnuplotContent({ xColumn, plot }: GnuplotContentParams) {
  if (plot.kind === 'single') {
    return singleContent(xColumn)
  }
  return comparisonContent(xColumn, plot.baselineTitle, plot.currentTitle)
}

export function singleContent(xColumn: XColumn) {
  const [xVar, xlabel] = getXAxisParams(xColumn)
  return `
${gnuplotHeader(xlabel)}

plot 'results/result.csv' using "${xVar}":metric with boxes
`
}

function comparisonContent(xColumn: XColumn, baselineTitle: string, currentTitle: string) {
  const [xVar, xlabel] = getXAxisParams(xColumn)
  return `
${gnuplotHeader(xlabel)}

plot 'results/baseline.csv' using "${xVar}":metric with lines title "${baselineTitle}", \
    'results/result.csv' using "${xVar}":metric with lines title "${currentTitle}", \
`
}

function getXAxisParams(xColumn: XColumn) {
  if (xColumn === 'models') {
    return ['numModels', 'Number of models']
  } else if (xColumn === 'relations') {
    return ['numRelations', 'Number of relations']
  } else {
    return ['numEnums', 'Number of enums']
  }
}

function gnuplotHeader(xlabel: string) {
  return `
set datafile separator ','

if (strlen(ARG1) > 0) {
    metric=ARG1
} else {
    metric="benchmark:total"
}

set xlabel '${xlabel}'
if (metric eq 'heap' || metric eq 'rss') {
    set ylabel sprintf('Memory consumption (%s)', metric)
    set format y '%.0s%cB'
} else {
    set ylabel sprintf('%s, ms', metric)
}`
}
