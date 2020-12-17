export function maskQuery(query: string): string {
  return query
    .replaceAll(/".*"/g, '"X"')
    .replaceAll(/[\s:\[]([+-]?([0-9]*[.])?[0-9]+)/g, (substr) => {
      return `${substr[0]}5`
    })
}
