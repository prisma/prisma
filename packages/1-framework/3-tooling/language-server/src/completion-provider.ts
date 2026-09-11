import {
  type AuthoringPslBlockDescriptorNamespace,
  isAuthoringPslBlockDescriptor,
} from '@internal/framework-components/authoring';
import type {
  AssembledAuthoringContributions,
  ControlMutationDefaults,
} from '@internal/framework-components/control';
import {
  type AttributeSpec,
  assembleAttributeSpecs,
  type BlockAttributeSpecFactory,
  type FieldSymbol,
  findBlockDescriptor,
  type ModelSymbol,
  type NamespaceSymbol,
  type Param,
  type PositionalParam,
  type SymbolTable,
} from '@internal/psl-parser';
import type {
  FieldAttributeAst,
  FieldDeclarationAst,
  GenericBlockDeclarationAst,
  ModelAttributeAst,
  ModelDeclarationAst,
  SourceFile,
} from '@internal/psl-parser/syntax';
import { blindCast } from '@internal/utils/casts';
import { type CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import type {
  AttributeNameCompletionContext,
  AttributeNamedKeyCompletionContext,
  DeclarationKeywordCompletionContext,
  GenericBlockKeyCompletionContext,
  ModelTypeCompletionContext,
  NamespaceMemberCompletionContext,
  PslCompletionContext,
} from './completion-context';
import { refinesScalarType } from './named-type-classification';

export interface PslCompletionCandidateSource {
  readonly scalarTypes: readonly string[];
  readonly pslBlockDescriptors: AuthoringPslBlockDescriptorNamespace;
  readonly symbolTable: SymbolTable;
  readonly authoringContributions?: AssembledAuthoringContributions;
  readonly controlMutationDefaults?: ControlMutationDefaults;
}

export interface ProvidePslCompletionItemsInput {
  readonly context: PslCompletionContext;
  readonly sourceFile: SourceFile;
  readonly candidates: PslCompletionCandidateSource;
  readonly clientSupportsSnippets: boolean;
}

type DeclarationKeywordCompletionCandidateCategory = 'native' | 'genericBlock';

type ModelTypeCompletionCandidateCategory =
  | 'configuredScalar'
  | 'topLevelModel'
  | 'topLevelCompositeType'
  | 'scalar'
  | 'typeAlias'
  | 'namespace'
  | 'namespaceModel'
  | 'namespaceCompositeType';

interface DeclarationKeywordCompletionCandidate {
  readonly category: DeclarationKeywordCompletionCandidateCategory;
  readonly label: string;
  readonly insertText: string;
  readonly snippetText: string;
  readonly detail: string;
  readonly kind: CompletionItemKind;
}

interface ModelTypeCompletionCandidate {
  readonly category: ModelTypeCompletionCandidateCategory;
  readonly label: string;
  readonly insertText: string;
  readonly filterText: string;
  readonly detail: string;
  readonly kind: CompletionItemKind;
}

const categoryOrder: Record<ModelTypeCompletionCandidateCategory, number> = {
  configuredScalar: 0,
  topLevelModel: 1,
  topLevelCompositeType: 2,
  scalar: 3,
  typeAlias: 4,
  namespace: 5,
  namespaceModel: 6,
  namespaceCompositeType: 7,
};

const declarationKeywordCategoryOrder: Record<
  DeclarationKeywordCompletionCandidateCategory,
  number
> = {
  native: 0,
  genericBlock: 1,
};

const nameSnippetPlaceholder = '$' + '{1:Name}';
const namespaceSnippetPlaceholder = '$' + '{1:name}';

const documentNativeDeclarationKeywords: readonly DeclarationKeywordCompletionCandidate[] = [
  nativeDeclarationKeyword('model', 'model ', `model ${nameSnippetPlaceholder} {\n  $0\n}`),
  nativeDeclarationKeyword('type', 'type ', `type ${nameSnippetPlaceholder} {\n  $0\n}`),
  nativeDeclarationKeyword('types', 'types ', 'types {\n  $0\n}'),
  nativeDeclarationKeyword(
    'namespace',
    'namespace ',
    `namespace ${namespaceSnippetPlaceholder} {\n  $0\n}`,
  ),
];

const namespaceNativeDeclarationKeywords: readonly DeclarationKeywordCompletionCandidate[] = [
  nativeDeclarationKeyword('model', 'model ', `model ${nameSnippetPlaceholder} {\n  $0\n}`),
  nativeDeclarationKeyword('type', 'type ', `type ${nameSnippetPlaceholder} {\n  $0\n}`),
];

export function providePslCompletionItems(
  input: ProvidePslCompletionItemsInput,
): readonly CompletionItem[] {
  const { context } = input;
  switch (context.kind) {
    case 'unsupported':
      return [];
    // Foreign contract-space members require the multi-input symbol table; no
    // contract-space registry exists today, so this position yields nothing yet.
    case 'spaceMember':
      return [];
    // Parameter-value completion (option allowed-values / ref scopes) is future
    // work.
    case 'genericBlockValue':
      return [];
    case 'fieldAttributeName':
    case 'modelAttributeName':
    case 'blockAttributeName':
      return provideAttributeNameCompletionItems(
        context,
        input.sourceFile,
        input.candidates,
        input.clientSupportsSnippets,
      );
    case 'fieldAttributeNamedKey':
    case 'modelAttributeNamedKey':
    case 'blockAttributeNamedKey':
      return provideAttributeNamedKeyCompletionItems(context, input.sourceFile, input.candidates);
    case 'declarationKeyword':
      return provideDeclarationKeywordCompletionItems(
        context,
        input.sourceFile,
        input.candidates,
        input.clientSupportsSnippets,
      );
    case 'genericBlockKey':
      return provideGenericBlockKeyCompletionItems(context, input.sourceFile, input.candidates);
    case 'modelType':
      return provideModelTypeCompletionItems(context, input.sourceFile, input.candidates);
    case 'namespaceMember':
      return provideNamespaceMemberCompletionItems(context, input.sourceFile, input.candidates);
  }
}

function provideAttributeNameCompletionItems(
  context: AttributeNameCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
  clientSupportsSnippets: boolean,
): readonly CompletionItem[] {
  const names = attributeNames(context, source);
  const replacementEndOffset = attributeNameReplacementEndOffset(context);
  const replacementRange = {
    start: sourceFile.positionAt(context.replacementStartOffset),
    end: sourceFile.positionAt(replacementEndOffset),
  };

  const resolveSpec = attributeSpecResolver(context, source);

  return names.map((name) => {
    const newText = attributeNameEditText({
      name,
      spec: resolveSpec(name),
      attribute: context.attribute,
      clientSupportsSnippets,
    });
    return {
      label: name,
      kind: CompletionItemKind.Function,
      detail: 'PSL attribute',
      sortText: name,
      filterText: name,
      textEdit: { range: replacementRange, newText },
      ...(newText !== name ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
    };
  });
}

function provideAttributeNamedKeyCompletionItems(
  context: AttributeNamedKeyCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
): readonly CompletionItem[] {
  const spec = attributeSpec(context, source);
  if (spec === undefined) {
    return [];
  }
  const existing = existingAttributeNamedKeys(context.attribute, context.offset);
  const replacementRange = {
    start: sourceFile.positionAt(context.replacementStartOffset),
    end: sourceFile.positionAt(namedKeyReplacementEndOffset(context)),
  };

  return Object.keys(spec.named)
    .filter((name) => !existing.has(name))
    .map((name) => ({
      label: name,
      kind: CompletionItemKind.Property,
      detail: 'Attribute argument',
      sortText: name,
      filterText: name,
      textEdit: { range: replacementRange, newText: name },
    }));
}

function attributeNames(
  context: AttributeNameCompletionContext,
  source: PslCompletionCandidateSource,
): readonly string[] {
  switch (context.kind) {
    case 'blockAttributeName': {
      const descriptor = findBlockDescriptor(source.pslBlockDescriptors, context.blockKeyword);
      return sortedUnique(Object.keys(descriptor?.attributes ?? {}));
    }
    case 'fieldAttributeName': {
      if (source.authoringContributions === undefined) {
        return [];
      }
      return sortedUnique(Object.keys(assembleAttributeSpecs(source.authoringContributions).field));
    }
    case 'modelAttributeName': {
      if (source.authoringContributions === undefined) {
        return [];
      }
      return sortedUnique(Object.keys(assembleAttributeSpecs(source.authoringContributions).model));
    }
  }
}

function attributeNameEditText(input: {
  readonly name: string;
  readonly spec: AttributeSpec<never, never> | undefined;
  readonly attribute: FieldAttributeAst | ModelAttributeAst;
  readonly clientSupportsSnippets: boolean;
}): string {
  if (
    !input.clientSupportsSnippets ||
    input.spec === undefined ||
    input.attribute.argList() !== undefined
  ) {
    return input.name;
  }

  const required = requiredAttributeArguments(input.spec);
  if (required.length === 0) {
    return input.name;
  }
  return `${input.name}(${required
    .map((argument, index) => requiredAttributeArgumentSnippet(argument, index + 1))
    .join(', ')})`;
}

type RequiredAttributeArgument =
  | { readonly kind: 'positional'; readonly argument: PositionalParam<unknown, never> }
  | { readonly kind: 'named'; readonly key: string; readonly type: Param<unknown, never> };

function requiredAttributeArguments(
  spec: AttributeSpec<never, never>,
): readonly RequiredAttributeArgument[] {
  const positionalKeys = new Set(spec.positional.map((argument) => argument.key));
  return [
    ...spec.positional.flatMap((argument) =>
      isOptionalParam(argument.type)
        ? []
        : [{ kind: 'positional', argument } satisfies RequiredAttributeArgument],
    ),
    ...Object.entries(spec.named).flatMap(([key, type]) =>
      positionalKeys.has(key) || isOptionalParam(type)
        ? []
        : [{ kind: 'named', key, type } satisfies RequiredAttributeArgument],
    ),
  ];
}

function requiredAttributeArgumentSnippet(
  argument: RequiredAttributeArgument,
  tabStop: number,
): string {
  if (argument.kind === 'positional') {
    return argSnippetPlaceholder(argument.argument.type, tabStop);
  }
  return `${argument.key}: ${argSnippetPlaceholder(argument.type, tabStop)}`;
}

function argSnippetPlaceholder(param: Param<unknown, never>, tabStop: number): string {
  const placeholder = `\${${tabStop.toString()}:}`;
  if (param.kind === 'str') {
    return `"${placeholder}"`;
  }
  if (param.kind === 'list') {
    return `[${placeholder}]`;
  }
  if (param.kind === 'record') {
    return `{ ${placeholder} }`;
  }
  return placeholder;
}

function isOptionalParam(param: Param<unknown, never>): boolean {
  return 'optional' in param && param.optional === true;
}

function attributeNameReplacementEndOffset(context: AttributeNameCompletionContext): number {
  return context.attribute.name()?.syntax.endOffset ?? context.offset;
}

function namedKeyReplacementEndOffset(context: AttributeNamedKeyCompletionContext): number {
  const token = context.attribute.syntax.tokenAtOffset(context.offset).rightBiased();
  if (token?.kind === 'Ident' && token.offset <= context.offset) {
    return token.endOffset;
  }
  return context.offset;
}

function attributeSpec(
  context: AttributeNamedKeyCompletionContext,
  source: PslCompletionCandidateSource,
): AttributeSpec<never, never> | undefined {
  return attributeSpecForName(context, source, context.attributeName);
}

function attributeSpecForName(
  context: AttributeNameCompletionContext | AttributeNamedKeyCompletionContext,
  source: PslCompletionCandidateSource,
  name: string,
): AttributeSpec<never, never> | undefined {
  return attributeSpecResolver(context, source)(name);
}

function attributeSpecResolver(
  context: AttributeNameCompletionContext | AttributeNamedKeyCompletionContext,
  source: PslCompletionCandidateSource,
): (name: string) => AttributeSpec<never, never> | undefined {
  switch (context.kind) {
    case 'blockAttributeName':
    case 'blockAttributeNamedKey': {
      const descriptor = findBlockDescriptor(source.pslBlockDescriptors, context.blockKeyword);
      return (name) => {
        const factory = descriptor?.attributes?.[name];
        if (factory === undefined) {
          return undefined;
        }
        return blindCast<
          BlockAttributeSpecFactory,
          'block descriptor attributes are validated as factories at control-stack assembly but exposed through framework-components as unknown to avoid a parser dependency'
        >(factory)();
      };
    }
    case 'modelAttributeName':
    case 'modelAttributeNamedKey': {
      if (source.authoringContributions === undefined) {
        return () => undefined;
      }
      const model = modelSymbolForNode(source.symbolTable, context.model);
      if (model === undefined || source.controlMutationDefaults === undefined) {
        return () => undefined;
      }
      const specs = assembleAttributeSpecs(source.authoringContributions);
      const specContext = {
        symbols: source.symbolTable,
        model,
        controlMutationDefaults: source.controlMutationDefaults.defaultFunctionRegistry,
      };
      return (name) => specs.model[name]?.(specContext);
    }
    case 'fieldAttributeName':
    case 'fieldAttributeNamedKey': {
      if (source.authoringContributions === undefined) {
        return () => undefined;
      }
      const model = modelSymbolForNode(source.symbolTable, context.model);
      if (model === undefined || source.controlMutationDefaults === undefined) {
        return () => undefined;
      }
      const field = fieldSymbolForNode(model, context.field);
      if (field === undefined) {
        return () => undefined;
      }
      const specs = assembleAttributeSpecs(source.authoringContributions);
      const specContext = {
        symbols: source.symbolTable,
        model,
        controlMutationDefaults: source.controlMutationDefaults.defaultFunctionRegistry,
      };
      return (name) =>
        specs.field[name]?.({
          ...specContext,
          field,
        });
    }
  }
}

function existingAttributeNamedKeys(
  attribute: FieldAttributeAst | ModelAttributeAst,
  cursorOffset: number,
): Set<string> {
  const names = new Set<string>();
  for (const arg of attribute.argList()?.args() ?? []) {
    if (!arg.syntax.isOutside(cursorOffset)) {
      continue;
    }
    const name = arg.name()?.name();
    if (name !== undefined) {
      names.add(name);
    }
  }
  return names;
}

function modelSymbolForNode(
  symbolTable: SymbolTable,
  node: ModelDeclarationAst,
): ModelSymbol | undefined {
  const topLevelMatch = Object.values(symbolTable.topLevel.models).find((model) =>
    sameSyntax(model.node.syntax, node.syntax),
  );
  if (topLevelMatch !== undefined) {
    return topLevelMatch;
  }
  for (const namespace of Object.values(symbolTable.topLevel.namespaces)) {
    const namespaceMatch = Object.values(namespace.models).find((model) =>
      sameSyntax(model.node.syntax, node.syntax),
    );
    if (namespaceMatch !== undefined) {
      return namespaceMatch;
    }
  }
  return undefined;
}

function fieldSymbolForNode(
  model: ModelSymbol,
  node: FieldDeclarationAst,
): FieldSymbol | undefined {
  return Object.values(model.fields).find((field) => sameSyntax(field.node.syntax, node.syntax));
}

function sameSyntax(
  left: { readonly offset: number; readonly endOffset: number },
  right: { readonly offset: number; readonly endOffset: number },
): boolean {
  return left.offset === right.offset && left.endOffset === right.endOffset;
}

function provideDeclarationKeywordCompletionItems(
  context: DeclarationKeywordCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
  clientSupportsSnippets: boolean,
): readonly CompletionItem[] {
  const replacementRange = {
    start: sourceFile.positionAt(context.replacementStartOffset),
    end: sourceFile.positionAt(context.offset),
  };

  return declarationKeywordCandidates(context.scope, source).map((candidate) => ({
    label: candidate.label,
    kind: candidate.kind,
    detail: candidate.detail,
    sortText: declarationKeywordSortText(candidate),
    filterText: candidate.label,
    ...(clientSupportsSnippets ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
    textEdit: {
      range: replacementRange,
      newText: clientSupportsSnippets ? candidate.snippetText : candidate.insertText,
    },
  }));
}

function declarationKeywordCandidates(
  scope: DeclarationKeywordCompletionContext['scope'],
  source: PslCompletionCandidateSource,
): readonly DeclarationKeywordCompletionCandidate[] {
  const nativeCandidates =
    scope === 'namespace' ? namespaceNativeDeclarationKeywords : documentNativeDeclarationKeywords;
  return [
    ...nativeCandidates,
    ...genericBlockDeclarationKeywordCandidates(source.pslBlockDescriptors),
  ];
}

function nativeDeclarationKeyword(
  label: string,
  insertText: string,
  snippetText: string,
): DeclarationKeywordCompletionCandidate {
  return {
    category: 'native',
    label,
    insertText,
    snippetText,
    detail: 'PSL declaration keyword',
    kind: CompletionItemKind.Keyword,
  };
}

function genericBlockDeclarationKeywordCandidates(
  descriptors: AuthoringPslBlockDescriptorNamespace,
): readonly DeclarationKeywordCompletionCandidate[] {
  return descriptorBlockKeywords(descriptors).map((keyword) => ({
    category: 'genericBlock',
    label: keyword,
    insertText: `${keyword} `,
    snippetText: `${keyword} ${nameSnippetPlaceholder} {\n  $0\n}`,
    detail: 'Generic block keyword',
    kind: CompletionItemKind.Keyword,
  }));
}

function descriptorBlockKeywords(
  descriptors: AuthoringPslBlockDescriptorNamespace,
): readonly string[] {
  const keywords: string[] = [];
  collectDescriptorBlockKeywords(descriptors, keywords);
  return sortedUnique(keywords);
}

function collectDescriptorBlockKeywords(
  descriptors: AuthoringPslBlockDescriptorNamespace,
  keywords: string[],
): void {
  for (const value of Object.values(descriptors)) {
    if (isAuthoringPslBlockDescriptor(value)) {
      keywords.push(value.keyword);
      continue;
    }
    collectDescriptorBlockKeywords(value, keywords);
  }
}

function declarationKeywordSortText(candidate: DeclarationKeywordCompletionCandidate): string {
  return `${declarationKeywordCategoryOrder[candidate.category]}:${candidate.label}`;
}

function provideGenericBlockKeyCompletionItems(
  context: GenericBlockKeyCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
): readonly CompletionItem[] {
  const descriptor = findBlockDescriptor(source.pslBlockDescriptors, context.blockKeyword);
  if (descriptor === undefined) {
    return [];
  }

  const existing = existingGenericBlockParameterNames(context.block, context.offset);
  const replacementRange = {
    start: sourceFile.positionAt(context.replacementStartOffset),
    end: sourceFile.positionAt(context.offset),
  };

  return Object.keys(descriptor.parameters)
    .filter((parameterName) => !existing.has(parameterName))
    .map((parameterName, index) => ({
      label: parameterName,
      kind: CompletionItemKind.Property,
      detail: 'Generic block parameter',
      sortText: genericBlockParameterSortText(index, parameterName),
      filterText: parameterName,
      textEdit: {
        range: replacementRange,
        newText: parameterName,
      },
    }));
}

function existingGenericBlockParameterNames(
  block: GenericBlockDeclarationAst,
  cursorOffset: number,
): Set<string> {
  const names = new Set<string>();
  for (const entry of block.entries()) {
    if (!entry.syntax.isOutside(cursorOffset)) {
      continue;
    }
    const name = entry.key()?.name();
    if (name !== undefined) {
      names.add(name);
    }
  }
  return names;
}

function provideModelTypeCompletionItems(
  context: ModelTypeCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
): readonly CompletionItem[] {
  return modelTypeCompletionItems(context, sourceFile, [
    ...configuredScalarCandidates(source.scalarTypes),
    ...topLevelSymbolCandidates(source.symbolTable, source.scalarTypes),
    ...allNamespaceCandidates(source.symbolTable),
  ]);
}

function provideNamespaceMemberCompletionItems(
  context: NamespaceMemberCompletionContext,
  sourceFile: SourceFile,
  source: PslCompletionCandidateSource,
): readonly CompletionItem[] {
  // A foreign contract-space reference resolves against external symbols that no
  // registry exposes yet; local namespace members must not stand in for them.
  if (context.space !== undefined) {
    return [];
  }
  return modelTypeCompletionItems(
    context,
    sourceFile,
    namespaceCandidates(source.symbolTable.topLevel.namespaces[context.namespace]),
  );
}

function modelTypeCompletionItems(
  context: ModelTypeCompletionContext | NamespaceMemberCompletionContext,
  sourceFile: SourceFile,
  candidates: readonly ModelTypeCompletionCandidate[],
): readonly CompletionItem[] {
  const replacementRange = {
    start: sourceFile.positionAt(context.replacementStartOffset),
    end: sourceFile.positionAt(context.offset),
  };

  return candidates.map((candidate) => ({
    label: candidate.label,
    kind: candidate.kind,
    detail: candidate.detail,
    sortText: sortText(candidate),
    filterText: candidate.filterText,
    textEdit: {
      range: replacementRange,
      newText: candidate.insertText,
    },
  }));
}

function configuredScalarCandidates(
  scalarTypes: readonly string[],
): readonly ModelTypeCompletionCandidate[] {
  return sortedUnique(scalarTypes).map((name) => ({
    category: 'configuredScalar',
    label: name,
    insertText: name,
    filterText: name,
    detail: 'Configured scalar type',
    kind: CompletionItemKind.Keyword,
  }));
}

function topLevelSymbolCandidates(
  symbolTable: SymbolTable,
  scalarTypes: readonly string[],
): readonly ModelTypeCompletionCandidate[] {
  const { topLevel } = symbolTable;
  const namedTypes = Object.values(topLevel.namedTypes);
  const scalarRefinementNames = namedTypes
    .filter((symbol) => refinesScalarType(symbol, scalarTypes))
    .map((symbol) => symbol.name)
    .sort(compareNames);
  const aliasNames = namedTypes
    .filter((symbol) => !refinesScalarType(symbol, scalarTypes))
    .map((symbol) => symbol.name)
    .sort(compareNames);
  return [
    ...symbolCandidates(
      recordNames(topLevel.models),
      'topLevelModel',
      'Model',
      CompletionItemKind.Class,
    ),
    ...symbolCandidates(
      recordNames(topLevel.compositeTypes),
      'topLevelCompositeType',
      'Composite type',
      CompletionItemKind.Struct,
    ),
    ...symbolCandidates(scalarRefinementNames, 'scalar', 'Scalar type', CompletionItemKind.Unit),
    ...symbolCandidates(aliasNames, 'typeAlias', 'Type alias', CompletionItemKind.Reference),
  ];
}

function allNamespaceCandidates(symbolTable: SymbolTable): readonly ModelTypeCompletionCandidate[] {
  return Object.values(symbolTable.topLevel.namespaces)
    .sort((left, right) => compareNames(left.name, right.name))
    .map(namespaceQualifierCandidate);
}

function namespaceCandidates(
  namespace: NamespaceSymbol | undefined,
): readonly ModelTypeCompletionCandidate[] {
  if (namespace === undefined) {
    return [];
  }
  return [
    ...symbolCandidates(
      recordNames(namespace.models),
      'namespaceModel',
      `Model in namespace ${namespace.name}`,
      CompletionItemKind.Class,
    ),
    ...symbolCandidates(
      recordNames(namespace.compositeTypes),
      'namespaceCompositeType',
      `Composite type in namespace ${namespace.name}`,
      CompletionItemKind.Struct,
    ),
  ];
}

function namespaceQualifierCandidate(namespace: NamespaceSymbol): ModelTypeCompletionCandidate {
  return {
    category: 'namespace',
    label: namespace.name,
    insertText: namespace.name,
    filterText: namespace.name,
    detail: 'Namespace',
    kind: CompletionItemKind.Module,
  };
}

function symbolCandidates(
  names: readonly string[],
  category: ModelTypeCompletionCandidateCategory,
  detail: string,
  kind: CompletionItemKind,
): readonly ModelTypeCompletionCandidate[] {
  return names.map((name) => ({
    category,
    label: name,
    insertText: name,
    filterText: name,
    detail,
    kind,
  }));
}

function recordNames<T extends { readonly name: string }>(
  record: Record<string, T>,
): readonly string[] {
  return Object.values(record)
    .map((symbol) => symbol.name)
    .sort(compareNames);
}

function sortedUnique(names: readonly string[]): readonly string[] {
  return [...new Set(names)].sort(compareNames);
}

function sortText(candidate: ModelTypeCompletionCandidate): string {
  return `${categoryOrder[candidate.category]}:${candidate.label}`;
}

function genericBlockParameterSortText(index: number, label: string): string {
  return `${index.toString().padStart(4, '0')}:${label}`;
}

function compareNames(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
