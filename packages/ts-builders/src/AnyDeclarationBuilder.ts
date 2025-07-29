import { ClassDeclaration } from './Class'
import { ConstDeclaration } from './ConstDeclaration'
import { InterfaceDeclaration } from './Interface'
import { NamespaceDeclaration } from './NamespaceDeclaration'
import { TypeDeclaration } from './TypeDeclaration'

// TODO: enum
export type AnyDeclarationBuilder =
  | TypeDeclaration
  | ConstDeclaration
  | InterfaceDeclaration
  | ClassDeclaration
  | NamespaceDeclaration
