// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Param<out $Type, $Value extends string> = {
  readonly name: $Value
}

export function Param<$Type, $Value extends string>(name: $Value): Param<$Type, $Value> {
  return { name }
}
