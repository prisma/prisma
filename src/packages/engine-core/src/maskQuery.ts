export function maskQuery(query?: string): string {
  if (!query) {
    return ''
  }
  return query
    .replace(/".*"/g, '"X"')
    .replace(/[\s:\[]([+-]?([0-9]*[.])?[0-9]+)/g, (substr) => {
      return `${substr[0]}5`
    })
}
