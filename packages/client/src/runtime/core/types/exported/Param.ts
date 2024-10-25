// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Param<out $Type, $Value extends string> = { __param: $Value }

export function Param<$Type, $Value extends string>(param: $Value): Param<$Type, $Value> {
  return { __param: param }
}
