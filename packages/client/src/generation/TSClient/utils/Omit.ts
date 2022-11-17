export function Omit(O: string, K: string, KName = 'P') {
  return `{ [${KName} in keyof (${O}) as ${KName} extends ${K} ? never : ${KName}]: (${O})[${KName}] }`
}
