import { ConstDeclaration } from './ConstDeclaration'
import { InterfaceDeclaration } from './Interface'
import { TypeDeclaration } from './TypeDeclaration'

// TODO: enum, class
export type AnyDeclarationBuilder = TypeDeclaration | ConstDeclaration | InterfaceDeclaration
