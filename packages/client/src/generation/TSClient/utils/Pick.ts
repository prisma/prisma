export function Pick(O: string, K: string, KName = 'P') {
  return `{ [${KName} in keyof (${O}) as ${KName} extends ${K} ? ${KName} : never]: (${O})[${KName}] }`
}
