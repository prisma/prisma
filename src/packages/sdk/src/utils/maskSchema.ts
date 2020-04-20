export function maskSchema(schema: string): string {
  const regex = /url\s*=\s*.+/
  return schema
    .split('\n')
    .map((line) => {
      const match = regex.exec(line)
      if (match) {
        return `${line.slice(0, match.index)}url = "***"`
      }
      return line
    })
    .join('\n')
}

export function mapScalarValues(obj: any, mapper: (value: any) => any): {} {
  const result = {}
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      result[key] = mapScalarValues(obj[key], mapper)
    } else {
      result[key] = mapper(obj[key])
    }
  }

  return result
}
