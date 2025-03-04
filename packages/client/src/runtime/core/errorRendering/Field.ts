import type { Value } from './Value'

export interface Field {
  value: Value
  markAsError(): void
}
