// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Param<out $Type, $Value extends string> = { $type: 'param'; value: $Value }

export function Param<$Type, $Value extends string>(param: $Value): Param<$Type, $Value> {
  return { $type: 'param', value: param }
}
