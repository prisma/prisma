type ComputeReferentialActionLine = {
  onUpdate: string
  onDelete: string
}

export function computeReferentialActionLine({ onUpdate, onDelete }: ComputeReferentialActionLine): string {
  let referentialActionLine = ''
  const DEFAULT = 'DEFAULT'

  if (onUpdate && onUpdate !== DEFAULT) {
    referentialActionLine += `, onUpdate: ${onUpdate}`
  }

  if (onDelete && onDelete !== DEFAULT) {
    referentialActionLine += `, onDelete: ${onDelete}`
  }

  return referentialActionLine
}
