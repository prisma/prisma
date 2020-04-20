export const arrayDiffer = <T extends any>(
  array: T[],
  ...values: T[][]
): T[] => {
  const rest = new Set(
    (<T[]>[]) // eslint-disable-line @typescript-eslint/consistent-type-assertions
      .concat(...values),
  )
  return array.filter((element) => !rest.has(element))
}
