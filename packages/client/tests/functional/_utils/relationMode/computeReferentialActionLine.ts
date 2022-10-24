type ComputeReferentialActionLine = {
  onUpdate: string
  onDelete: string
}

export type ReferentialActionLineOutput = {
  // is the referential action supported by a relation whose field arity is required?
  supportsRequired: boolean

  // the referential action part of a relation, e.g. `onUpdate: Cascade, onDelete: Cascade`
  referentialActionLine: string
}

export function computeReferentialActionLine({
  onUpdate,
  onDelete,
}: ComputeReferentialActionLine): ReferentialActionLineOutput {
  // required fields in a relation do not support the `SetNull` referential action
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
