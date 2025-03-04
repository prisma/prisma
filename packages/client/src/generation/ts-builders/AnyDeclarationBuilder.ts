import type { ClassDeclaration } from './Class'
import type { ConstDeclaration } from './ConstDeclaration'
import type { InterfaceDeclaration } from './Interface'
import type { NamespaceDeclaration } from './NamespaceDeclaration'
import type { TypeDeclaration } from './TypeDeclaration'

// TODO: enum
export type AnyDeclarationBuilder =
  | TypeDeclaration
  | ConstDeclaration
  | InterfaceDeclaration
  | ClassDeclaration
  | NamespaceDeclaration
