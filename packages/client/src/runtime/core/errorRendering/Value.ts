import { ArrayValue } from './ArrayValue'
import { ObjectValue } from './ObjectValue'
import { ScalarValue } from './ScalarValue'

export type Value = ObjectValue | ArrayValue | ScalarValue
