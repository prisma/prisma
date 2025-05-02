import { DataRule, ValidationError } from '../QueryPlan'
import { UserFacingError } from '../UserFacingError'
import { assertNever } from '../utils'

export function performValidation(data: unknown, rules: DataRule[], error: ValidationError) {
  if (!doesSatsifyRules(data, rules)) {
    const message = renderMessage(data, error)
    const code = getErrorCode(error)
    throw new UserFacingError(message, code, data)
  }
}

function doesSatsifyRules(data: unknown, rules: DataRule[]): boolean {
  for (const rule of rules) {
    switch (rule.type) {
      case 'rowCountEq':
        if (Array.isArray(data) && data.length !== rule.args) {
          return false
        }
        if (data === null) {
          return rule.args === 0
        }
        return rule.args === 1
      case 'rowCountNeq':
        if (Array.isArray(data) && data.length === rule.args) {
          return false
        }
        if (data === null) {
          return rule.args !== 0
        }
        return rule.args !== 1
    }
  }
  return true
}

function renderMessage(data: unknown, error: ValidationError): string {
  switch (error.error_identifier) {
    case 'RELATION_VIOLATION':
      return `The change you are trying to make would violate the required relation '${error.context.relation}' between the \`${error.context.modelA}\` and \`${error.context.modelB}\` models.`
    case 'MISSING_RECORD':
      return `No record was found for ${error.context.operation}.`
    case 'MISSING_RELATED_RECORD': {
      const hint = error.context.neededFor ? ` (needed to ${error.context.neededFor})` : ''
      return `An operation failed because it depends on one or more records that were required but not found. No '${error.context.model}' record${hint} was found for ${error.context.operation} on ${error.context.relationType} relation '${error.context.relation}'.`
    }
    case 'INCOMPLETE_CONNECT_INPUT':
      return `Expected ${error.context.expectedRows} records to be connected, found only ${
        Array.isArray(data) ? data.length : 0
      }.`
    case 'RECORDS_NOT_CONNECTED':
      return `The records for relation \`${error.context.relation}\` between the \`${error.context.parent}\` and \`${error.context.child}\` models are not connected.`

    default:
      assertNever(error, `Unknown error identifier: ${error}`)
  }
}

function getErrorCode(error: ValidationError): string {
  switch (error.error_identifier) {
    case 'RELATION_VIOLATION':
      return 'P2014'
    case 'RECORDS_NOT_CONNECTED':
      return 'P2017'
    case 'MISSING_RECORD':
    case 'MISSING_RELATED_RECORD':
    case 'INCOMPLETE_CONNECT_INPUT':
      return 'P2025'

    default:
      assertNever(error, `Unknown error identifier: ${error}`)
  }
}
