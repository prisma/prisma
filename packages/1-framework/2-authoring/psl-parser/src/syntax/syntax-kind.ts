export type SyntaxKind =
  | 'Document'
  | 'ModelDeclaration'
  | 'CompositeTypeDeclaration'
  | 'Namespace'
  | 'TypesBlock'
  // The generic/extension block node: the `kw [name] { key = value }` form,
  // distinct from the reserved `model`/`namespace`/`type`/`types` declarations.
  | 'GenericBlockDeclaration'
  | 'FieldDeclaration'
  | 'NamedTypeDeclaration'
  | 'KeyValuePair'
  | 'FieldAttribute'
  | 'ModelAttribute'
  | 'AttributeArgList'
  | 'AttributeArg'
  | 'TypeAnnotation'
  | 'Identifier'
  // A namespace-qualified name `[space ':']? Ident ('.' Ident)*`.
  | 'QualifiedName'
  | 'FunctionCall'
  | 'ArrayLiteral'
  | 'StringLiteralExpr'
  | 'NumberLiteralExpr'
  | 'BooleanLiteralExpr'
  | 'ObjectLiteralExpr'
  | 'ObjectField';
