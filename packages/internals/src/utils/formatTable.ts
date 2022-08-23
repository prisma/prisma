function slugify(str: string): string {
  return str.toString().toLowerCase().replace(/\s+/g, '-')
}

type FormatTableOptions = {
  json?: boolean
}

export function formatTable(rows: string[][], options = { json: false } as FormatTableOptions): string {
  if (options.json) {
    const result = rows.reduce((acc, [name, value]) => {
      acc[slugify(name)] = value
      return acc
    }, {})
    return JSON.stringify(result, null, 2)
  }

  const maxPad = rows.reduce((acc, curr) => Math.max(acc, curr[0].length), 0)
  return rows.map(([left, right]) => `${left.padEnd(maxPad)} : ${right}`).join('\n')
}
