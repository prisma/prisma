import { ConstDeclaration } from './ConstDeclaration'
import { TypeDeclaration } from './TypeDeclaration'

// TODO: enum, class, interface
export type AnyDeclarationBuilder = TypeDeclaration | ConstDeclaration
