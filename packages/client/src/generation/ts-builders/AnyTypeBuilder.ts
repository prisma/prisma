import { ArraySpread } from './ArraySpread'
import { ArrayType } from './ArrayType'
import { FunctionType } from './FunctionType'
import { KeyType } from './KeyType'
import { NamedType } from './NamedType'
import { ObjectType } from './ObjectType'
import { PrimitiveType } from './PrimitiveType'
import { StringLiteralType } from './StringLiteralType'
import { UnionType } from './UnionType'

export type AnyTypeBuilder =
  | NamedType
  | ArrayType
  | PrimitiveType
  | ArraySpread
  | ObjectType
  | FunctionType
  | UnionType
  | StringLiteralType
  | KeyType
