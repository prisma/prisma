import {
  AttributeArgListAst,
  any,
  type BracedBlock,
  CompositeTypeDeclarationAst,
  type DocumentAst,
  FieldAttributeAst,
  FieldDeclarationAst,
  GenericBlockDeclarationAst,
  KeyValuePairAst,
  ModelAttributeAst,
  ModelDeclarationAst,
  NamespaceDeclarationAst,
  type Position,
  type QualifiedNameAst,
  type SourceFile,
  type SyntaxNode,
  type SyntaxToken,
  skipTriviaToken,
  type TokenAtOffset,
  TypesBlockAst,
} from '@internal/psl-parser/syntax';

export interface ClassifyPslCompletionContextInput {
  readonly document: DocumentAst;
  readonly sourceFile: SourceFile;
  readonly position: Position;
}

export interface ModelTypeCompletionContext {
  readonly kind: 'modelType';
  readonly offset: number;
  readonly fieldName: string;
  readonly replacementStartOffset: number;
}

export interface SpaceMemberCompletionContext {
  readonly kind: 'spaceMember';
  readonly offset: number;
  readonly fieldName: string;
  readonly replacementStartOffset: number;
  readonly space: string;
}

export interface NamespaceMemberCompletionContext {
  readonly kind: 'namespaceMember';
  readonly offset: number;
  readonly fieldName: string;
  readonly replacementStartOffset: number;
  readonly namespace: string;
  readonly space?: string;
}

export interface GenericBlockKeyCompletionContext {
  readonly kind: 'genericBlockKey';
  readonly offset: number;
  readonly blockKeyword: string;
  readonly replacementStartOffset: number;
  readonly block: GenericBlockDeclarationAst;
}

export interface GenericBlockValueCompletionContext {
  readonly kind: 'genericBlockValue';
  readonly offset: number;
  readonly blockKeyword: string;
  readonly replacementStartOffset: number;
}

export type DeclarationKeywordCompletionScope = 'document' | 'namespace';

export interface DeclarationKeywordCompletionContext {
  readonly kind: 'declarationKeyword';
  readonly offset: number;
  readonly scope: DeclarationKeywordCompletionScope;
  readonly replacementStartOffset: number;
}

export interface UnsupportedPslCompletionContext {
  readonly kind: 'unsupported';
}

export type PslCompletionContext =
  | DeclarationKeywordCompletionContext
  | GenericBlockKeyCompletionContext
  | GenericBlockValueCompletionContext
  | ModelTypeCompletionContext
  | NamespaceMemberCompletionContext
  | SpaceMemberCompletionContext
  | UnsupportedPslCompletionContext;

const UNSUPPORTED: UnsupportedPslCompletionContext = { kind: 'unsupported' };

export function classifyPslCompletionContext(
  input: ClassifyPslCompletionContextInput,
): PslCompletionContext {
  const root = input.document.syntax;
  const offset = input.sourceFile.offsetAt(input.position);
  const at = root.tokenAtOffset(offset);

  // Completion is never offered when the cursor sits inside a comment.
  if (at.leftBiased()?.kind === 'Comment') {
    return UNSUPPORTED;
  }

  // The edit replaces the identifier under the cursor, or is empty when the
  // cursor sits in trivia.
  const edit = cursorIdentifier(at, offset);

  // Anchor on the significant token preceding the cursor and navigate outward
  // via `token.parent` rather than scanning the whole tree.
  const preceding = precedingToken(at, edit);
  const precedingNode = preceding?.parent;
  const replacementStartOffset = edit?.offset ?? offset;

  const declarationKeywordContext = classifyDeclarationKeyword({
    node: precedingNode,
    offset,
    replacementStartOffset,
  });
  if (declarationKeywordContext !== undefined) {
    return declarationKeywordContext;
  }

  const genericBlockContext = classifyGenericBlockParameter({
    offset,
    at,
    precedingToken: preceding,
    replacementStartOffset,
  });
  if (genericBlockContext !== undefined) {
    return genericBlockContext;
  }

  const field = fieldForTypeSlot(precedingNode);
  if (field === undefined) {
    return UNSUPPORTED;
  }
  if (
    field.syntax.findAncestor(any(ModelDeclarationAst.cast, CompositeTypeDeclarationAst.cast)) ===
    undefined
  ) {
    return UNSUPPORTED;
  }

  return classifyModelFieldType({
    field,
    offset,
    replacementStartOffset,
    precedingToken: preceding,
  });
}

/**
 * Locates the field whose type position the cursor occupies. The preceding token
 * climbs to the field whether the cursor sits inside a present type (the type
 * identifier's predecessor still belongs to the field) or in the empty type slot
 * of a typeless field (whose trailing trivia lives in the enclosing block, so
 * the nearest significant token to the left is the field's own name).
 */
function fieldForTypeSlot(precedingNode: SyntaxNode | undefined): FieldDeclarationAst | undefined {
  return precedingNode?.findAncestor(FieldDeclarationAst.cast);
}

function classifyModelFieldType(input: {
  readonly field: FieldDeclarationAst;
  readonly offset: number;
  readonly replacementStartOffset: number;
  readonly precedingToken: SyntaxToken | undefined;
}): PslCompletionContext {
  const fieldName = input.field.name();
  if (fieldName === undefined) {
    return UNSUPPORTED;
  }
  const fieldNameText = fieldName.name();
  if (fieldNameText === undefined) {
    return UNSUPPORTED;
  }

  if (fieldName.syntax.isInside(input.offset)) {
    return UNSUPPORTED;
  }

  const typeAnnotation = input.field.typeAnnotation();
  if (typeAnnotation === undefined) {
    if (
      input.precedingToken !== undefined &&
      fieldName.syntax.isInside(input.precedingToken.offset)
    ) {
      return {
        kind: 'modelType',
        offset: input.offset,
        fieldName: fieldNameText,
        replacementStartOffset: input.offset,
      };
    }
    return UNSUPPORTED;
  }

  if (typeAnnotation.syntax.isOutside(input.offset)) {
    return UNSUPPORTED;
  }

  const constructorArgList = typeAnnotation.argList();
  if (constructorArgList?.syntax.isInside(input.offset)) {
    return UNSUPPORTED;
  }

  const name = typeAnnotation.name();
  if (name === undefined) {
    return UNSUPPORTED;
  }
  if (name.syntax.isOutside(input.offset)) {
    return UNSUPPORTED;
  }
  if (name.isOverQualified()) {
    return UNSUPPORTED;
  }

  return classifyTypePosition(name, input.offset, fieldNameText, input.replacementStartOffset);
}

/**
 * Builds the type-completion context for a qualified name. Roles are read
 * straight off the separator-positional accessors: a populated namespace
 * segment is a `.`-qualified name, a populated space segment is a `:`-qualified
 * name, and the absence of both is a bare model type.
 *
 * Behaviour change: a `:`-qualified name with no `.` (e.g. `supabase:`,
 * `supabase:U`) is a `spaceMember` position rather than falling through to bare
 * model-type completions. A malformed leading-separator name (`:User`, `.User`)
 * carries no populated segment and resolves to `modelType` rather than
 * `unsupported`.
 */
function classifyTypePosition(
  name: QualifiedNameAst,
  offset: number,
  fieldName: string,
  replacementStartOffset: number,
): ModelTypeCompletionContext | SpaceMemberCompletionContext | NamespaceMemberCompletionContext {
  const namespace = name.namespace()?.name();
  if (namespace !== undefined && namespace.length > 0) {
    const namespaceSpace = name.space()?.name();
    return {
      kind: 'namespaceMember',
      offset,
      fieldName,
      replacementStartOffset,
      namespace,
      ...(namespaceSpace !== undefined && namespaceSpace.length > 0
        ? { space: namespaceSpace }
        : {}),
    };
  }
  const space = name.space()?.name();
  if (space !== undefined && space.length > 0) {
    return { kind: 'spaceMember', offset, fieldName, replacementStartOffset, space };
  }
  return { kind: 'modelType', offset, fieldName, replacementStartOffset };
}

const declarationCast = any(
  ModelDeclarationAst.cast,
  CompositeTypeDeclarationAst.cast,
  TypesBlockAst.cast,
  GenericBlockDeclarationAst.cast,
  NamespaceDeclarationAst.cast,
);

type DeclarationAst = NonNullable<ReturnType<typeof declarationCast>>;

function classifyDeclarationKeyword(input: {
  readonly node: SyntaxNode | undefined;
  readonly offset: number;
  readonly replacementStartOffset: number;
}): DeclarationKeywordCompletionContext | undefined {
  const precedingDeclaration = input.node?.findAncestor(declarationCast);
  const namespace = input.node?.findAncestor(NamespaceDeclarationAst.cast);
  const inNamespaceBody = blockBodyContainsOffset(namespace, input.offset);

  if (
    precedingDeclaration !== undefined &&
    !canCompleteDeclaration(precedingDeclaration, input.offset, inNamespaceBody)
  ) {
    return undefined;
  }

  return {
    kind: 'declarationKeyword',
    offset: input.offset,
    scope: inNamespaceBody ? 'namespace' : 'document',
    replacementStartOffset: input.replacementStartOffset,
  };
}

/**
 * Whether a new declaration can begin at the cursor, given the nearest enclosing
 * declaration. Allowed when that declaration is still nascent (only its keyword
 * typed, no name or body yet), when it is a namespace whose body holds further
 * declarations, or when the cursor sits past its closing `}`.
 */
function canCompleteDeclaration(
  precedingDeclaration: DeclarationAst,
  offset: number,
  inNamespaceBody: boolean,
): boolean {
  const keywordOnly =
    precedingDeclaration.lbrace() === undefined &&
    (precedingDeclaration instanceof TypesBlockAst || precedingDeclaration.name() === undefined);
  if (keywordOnly) {
    return true;
  }
  if (precedingDeclaration instanceof NamespaceDeclarationAst && inNamespaceBody) {
    return true;
  }
  const rbrace = precedingDeclaration.rbrace();
  return rbrace !== undefined && offset >= rbrace.endOffset;
}

function blockBodyContainsOffset(block: BracedBlock | undefined, offset: number): boolean {
  if (block === undefined) {
    return false;
  }
  const lbrace = block.lbrace();
  if (lbrace === undefined) {
    return false;
  }
  const bodyStart = lbrace.endOffset;
  const bodyEnd = block.rbrace()?.offset ?? block.syntax.endOffset;
  return offset >= bodyStart && offset <= bodyEnd;
}

function classifyGenericBlockParameter(input: {
  readonly offset: number;
  readonly at: TokenAtOffset;
  readonly precedingToken: SyntaxToken | undefined;
  readonly replacementStartOffset: number;
}): PslCompletionContext | undefined {
  // Whether the cursor sits in a key, value, or attribute slot is a structural
  // question, so it anchors on the cursor's own node — including any in-progress
  // identifier — rather than the edit-skipped `precedingToken` used for gaps.
  const node = input.at.leftBiased()?.parent;
  const block = node?.findAncestor(GenericBlockDeclarationAst.cast);
  if (block === undefined) {
    return undefined;
  }

  if (hasUnsupportedAncestor(node)) {
    return UNSUPPORTED;
  }

  if (!blockBodyContainsOffset(block, input.offset)) {
    return UNSUPPORTED;
  }

  const field = node?.findAncestor(FieldDeclarationAst.cast);
  if (field?.syntax.isInside(input.offset)) {
    return UNSUPPORTED;
  }

  const keyword = block.keyword()?.text;
  if (keyword === undefined || keyword.length === 0) {
    return UNSUPPORTED;
  }

  // Value position: the cursor follows a `=`. The position is now classified
  // distinctly from keys; populating value candidates is the provider's concern.
  if (input.precedingToken?.kind === 'Equals') {
    return {
      kind: 'genericBlockValue',
      offset: input.offset,
      blockKeyword: keyword,
      replacementStartOffset: input.replacementStartOffset,
    };
  }

  const activePair = activeKeyValuePair(node, input.offset);
  if (activePair !== undefined && isAfterEquals(activePair, input.offset)) {
    return UNSUPPORTED;
  }

  return {
    kind: 'genericBlockKey',
    offset: input.offset,
    blockKeyword: keyword,
    replacementStartOffset: input.replacementStartOffset,
    block,
  };
}

function activeKeyValuePair(
  node: SyntaxNode | undefined,
  offset: number,
): KeyValuePairAst | undefined {
  const pair = node?.findAncestor(KeyValuePairAst.cast);
  if (pair === undefined || pair.syntax.isOutside(offset)) {
    return undefined;
  }
  return pair;
}

function isAfterEquals(pair: KeyValuePairAst, offset: number): boolean {
  const equals = pair.equals();
  return equals !== undefined && offset > equals.offset;
}

function hasUnsupportedAncestor(node: SyntaxNode | undefined): boolean {
  return (
    node?.findAncestor(
      any(AttributeArgListAst.cast, FieldAttributeAst.cast, ModelAttributeAst.cast),
    ) !== undefined
  );
}

/** The significant token preceding the cursor — the in-progress edit identifier
 *  is skipped, so the result is the token the classifier anchors on. */
function precedingToken(at: TokenAtOffset, edit: SyntaxToken | undefined): SyntaxToken | undefined {
  const start = edit !== undefined ? edit.prevToken : at.leftBiased();
  return start === undefined ? undefined : skipTriviaToken(start, 'prev');
}

/** The identifier token the cursor is editing, if any. */
function cursorIdentifier(at: TokenAtOffset, offset: number): SyntaxToken | undefined {
  const right = at.rightBiased();
  if (right?.kind === 'Ident' && offset < right.endOffset) {
    return right;
  }
  const left = at.leftBiased();
  if (left?.kind === 'Ident' && left.endOffset === offset) {
    return left;
  }
  return undefined;
}
