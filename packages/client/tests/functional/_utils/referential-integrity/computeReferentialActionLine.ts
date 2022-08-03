type ComputeReferentialActionLine = {
  referentialActions: {
    onUpdate: string
    onDelete: string
  }
}

export function computeReferentialActionLine({ referentialActions }: ComputeReferentialActionLine): string {
  let referentialActionLine = ''
  const DEFAULT = 'DEFAULT'
  
  if (referentialActions.onUpdate && referentialActions.onUpdate !== DEFAULT) {
    referentialActionLine += `, onUpdate: ${referentialActions.onUpdate}`
  }
  
  if (referentialActions.onDelete && referentialActions.onDelete !== DEFAULT) {
    referentialActionLine += `, onDelete: ${referentialActions.onDelete}`
  }

  return referentialActionLine
}
