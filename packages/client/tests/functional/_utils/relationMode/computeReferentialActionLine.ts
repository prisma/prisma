type ComputeReferentialActionLine = {
  onUpdate: string
  onDelete: string
}

export type ReferentialActionLineOutput = { supportsRequired: boolean; referentialActionLine: string }

export function computeReferentialActionLine({
  onUpdate,
  onDelete,
}: ComputeReferentialActionLine): ReferentialActionLineOutput {
  const supportsRequired = ![onUpdate, onDelete].includes('SetNull')

  let referentialActionLine = ''
  const DEFAULT = 'DEFAULT'

  if (onUpdate && onUpdate !== DEFAULT) {
    referentialActionLine += `, onUpdate: ${onUpdate}`
  }

  if (onDelete && onDelete !== DEFAULT) {
    referentialActionLine += `, onDelete: ${onDelete}`
  }

  return { supportsRequired, referentialActionLine }
}
