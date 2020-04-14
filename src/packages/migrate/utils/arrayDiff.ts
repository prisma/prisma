export const arrayDiffer = <T extends any>(array: T[], ...values: T[][]) => {
  const rest = new Set((<T[]>[]).concat(...values))
  return array.filter(element => !rest.has(element))
}
