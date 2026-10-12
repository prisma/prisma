import type { PslSpan } from '@internal/framework-components/psl-ast';
import { PSL_UNRESOLVED_REFERENCE } from './diagnostic';
import type { ParseDiagnostic } from './parse';
import {
  nodePslSpan,
  type ResolvedAttribute,
  type ResolvedTypeConstructorCall,
  readResolvedAttribute,
  readResolvedAttributes,
  readResolvedConstructorCall,
} from './resolve';
import { lookupMixinReference, type MixinResolution } from './scope';
import type { PslSources, Range } from './source-file';
import { type FieldAttributeAst, ModelAttributeAst } from './syntax/ast/attributes';
import {
  CompositeTypeDeclarationAst,
  type DocumentAst,
  FieldDeclarationAst,
  type GenericBlockDeclarationAst,
  KeyValuePairAst,
  MixinDeclarationAst,
  type MixinInclusionAst,
  ModelDeclarationAst,
  type NamedTypeDeclarationAst,
  NamespaceDeclarationAst,
  type NamespaceMemberAst,
  TypesBlockAst,
} from './syntax/ast/declarations';
import type { IdentifierAst } from './syntax/ast/identifier';
import { printSyntax } from './syntax/ast-helpers';
import type { SyntaxNode } from './syntax/red';

export type {
  ResolvedAttribute,
  ResolvedAttributeArg,
  ResolvedTypeConstructorCall,
} from './resolve';

export interface SymbolTable {
  readonly topLevel: TopLevelScope;
}

export interface TopLevelScope {
  readonly namespaces: Record<string, NamespaceSymbol>;
  readonly namedTypes: Record<string, NamedTypeSymbol>;
  readonly blocks: Record<string, BlockSymbol>;
  readonly models: Record<string, ModelSymbol>;
  readonly compositeTypes: Record<string, CompositeTypeSymbol>;
  readonly mixins: Record<string, MixinSymbol>;
}

interface NamespaceDeclaration {
  readonly node: NamespaceDeclarationAst;
  readonly span: PslSpan;
}

export interface NamespaceSymbol {
  readonly kind: 'namespace';
  readonly name: string;
  readonly declarations: [NamespaceDeclaration, ...NamespaceDeclaration[]];
  readonly models: Record<string, ModelSymbol>;
  readonly compositeTypes: Record<string, CompositeTypeSymbol>;
  readonly blocks: Record<string, BlockSymbol>;
  readonly mixins: Record<string, MixinSymbol>;
}

export interface ResolvedInclusion {
  readonly node: MixinInclusionAst;
  readonly mixin: MixinResolution | undefined;
  readonly qualifier: NamespaceSymbol | undefined;
}

export interface ModelSymbol {
  readonly kind: 'model';
  readonly name: string;
  readonly node: ModelDeclarationAst;
  readonly span: PslSpan;
  readonly fields: Record<string, FieldSymbol>;
  readonly attributes: readonly ResolvedAttribute<ModelAttributeAst>[];
  readonly inclusions: readonly ResolvedInclusion[];
}

export interface CompositeTypeSymbol {
  readonly kind: 'compositeType';
  readonly name: string;
  readonly node: CompositeTypeDeclarationAst;
  readonly span: PslSpan;
  readonly fields: Record<string, FieldSymbol>;
  readonly attributes: readonly ResolvedAttribute<ModelAttributeAst>[];
  readonly inclusions: readonly ResolvedInclusion[];
}

export interface BlockSymbol {
  readonly kind: 'block';
  readonly name: string;
  readonly keyword: string;
  readonly node: GenericBlockDeclarationAst;
  readonly span: PslSpan;
  readonly entries: readonly KeyValuePairAst[];
  readonly attributes: readonly ResolvedAttribute<ModelAttributeAst>[];
  readonly inclusions: readonly ResolvedInclusion[];
}

export interface MixinSymbol {
  readonly kind: 'mixin';
  readonly name: string;
  readonly keyword: string;
  readonly node: MixinDeclarationAst;
  readonly span: PslSpan;
  readonly fields: Record<string, FieldSymbol>;
  readonly entries: readonly KeyValuePairAst[];
  readonly attributes: readonly ResolvedAttribute<ModelAttributeAst>[];
}

export interface ResolvedNamedTypeBinding {
  readonly baseType?: string;
  readonly typeConstructor?: ResolvedTypeConstructorCall;
  readonly isConstructor: boolean;
  readonly attributes: readonly ResolvedAttribute<FieldAttributeAst>[];
}

/**
 * A `types {}` binding, collected without classification: whether the binding
 * refines a target scalar is pronounced by the interpreter
 * (`resolveNamedTypeDeclarations`), not by the family-blind symbol table.
 */
export interface NamedTypeSymbol extends ResolvedNamedTypeBinding {
  readonly kind: 'namedType';
  readonly name: string;
  readonly node: NamedTypeDeclarationAst;
  readonly span: PslSpan;
}

export interface FieldSymbol {
  readonly kind: 'field';
  readonly name: string;
  readonly node: FieldDeclarationAst;
  readonly span: PslSpan;
  readonly typeName: string;
  readonly typeNamespaceId?: string;
  readonly typeContractSpaceId?: string;
  readonly optional: boolean;
  readonly list: boolean;
  /** Element-nullability axis (`Foo?[]`); meaningful only when {@link list}. */
  readonly elementOptional: boolean;
  readonly typeConstructor?: ResolvedTypeConstructorCall;
  readonly attributes: readonly ResolvedAttribute<FieldAttributeAst>[];
  /** Prevents cascading unsupported-type diagnostics after invalid qualification. */
  readonly malformedType?: boolean;
}

export interface BuildSymbolTableOptions {
  readonly documents: readonly DocumentAst[];
  readonly sources: PslSources;
}

export interface SymbolTableResult {
  readonly symbolTable: SymbolTable;
  readonly diagnostics: readonly ParseDiagnostic[];
}

/**
 * Owns duplicate-declaration detection for all PSL scopes; downstream consumers
 * should consume first-wins symbols rather than re-emitting duplicate diagnostics.
 */
export function buildSymbolTable(options: BuildSymbolTableOptions): SymbolTableResult {
  const { documents, sources } = options;
  const diagnostics: ParseDiagnostic[] = [];
  const topLevel: TopLevelScope = {
    namespaces: Object.create(null),
    namedTypes: Object.create(null),
    blocks: Object.create(null),
    models: Object.create(null),
    compositeTypes: Object.create(null),
    mixins: Object.create(null),
  };
  const context: BuildContext = { topLevel, sources, diagnostics };
  const topLevelNames = new Set<string>();
  const namespaceNames = new Map<NamespaceSymbol, Set<string>>();
  const topLevelBuilds: (() => void)[] = [];
  const namespaceBuilds: (() => void)[] = [];

  const claim = (
    taken: Set<string>,
    name: IdentifierAst | undefined,
    filename: string,
  ): string | undefined => {
    const text = name?.name();
    if (name === undefined || text === undefined) return undefined;
    if (taken.has(text)) {
      const diagnostic = duplicateDeclaration(text, name, filename, sources);
      if (diagnostic !== undefined) diagnostics.push(diagnostic);
      return undefined;
    }
    taken.add(text);
    return text;
  };

  const declare = (
    declaration: NamespaceMemberAst,
    namespace: NamespaceSymbol | undefined,
    filename: string,
  ): void => {
    const records = namespace ?? topLevel;
    const taken = (namespace && namespaceNames.get(namespace)) ?? topLevelNames;
    const builds = namespace === undefined ? topLevelBuilds : namespaceBuilds;
    const name = claim(taken, declaration.name(), filename);
    if (name === undefined) return;
    if (declaration instanceof MixinDeclarationAst) {
      records.mixins[name] = buildMixin(name, declaration, context);
    } else if (declaration instanceof ModelDeclarationAst) {
      builds.push(() => {
        records.models[name] = buildModel(name, declaration, namespace, context);
      });
    } else if (declaration instanceof CompositeTypeDeclarationAst) {
      builds.push(() => {
        records.compositeTypes[name] = buildCompositeType(name, declaration, namespace, context);
      });
    } else {
      builds.push(() => {
        records.blocks[name] = buildBlock(name, declaration, namespace, context);
      });
    }
  };

  const openNamespace = (
    declaration: NamespaceDeclarationAst,
    filename: string,
  ): NamespaceSymbol | undefined => {
    const declaredName = declaration.name()?.name();
    if (declaredName === undefined) return undefined;
    const part = { node: declaration, span: nodePslSpan(declaration.syntax, sources) };
    const reopened = topLevel.namespaces[declaredName];
    if (reopened !== undefined) {
      reopened.declarations.push(part);
      return reopened;
    }
    const name = claim(topLevelNames, declaration.name(), filename);
    if (name === undefined) return undefined;
    const namespace: NamespaceSymbol = {
      kind: 'namespace',
      name,
      declarations: [part],
      models: Object.create(null),
      compositeTypes: Object.create(null),
      blocks: Object.create(null),
      mixins: Object.create(null),
    };
    topLevel.namespaces[name] = namespace;
    namespaceNames.set(namespace, new Set());
    return namespace;
  };

  for (const document of documents) {
    const { filename } = sources.sourceFileFor(document.syntax);
    for (const declaration of document.declarations()) {
      if (declaration instanceof NamespaceDeclarationAst) {
        const namespace = openNamespace(declaration, filename);
        if (namespace === undefined) continue;
        for (const member of declaration.declarations()) declare(member, namespace, filename);
      } else if (declaration instanceof TypesBlockAst) {
        for (const binding of declaration.declarations()) {
          const name = claim(topLevelNames, binding.name(), filename);
          if (name === undefined) continue;
          const resolved = resolveNamedTypeBinding(binding, sources);
          const span = nodePslSpan(binding.syntax, sources);
          topLevel.namedTypes[name] = { kind: 'namedType', name, node: binding, span, ...resolved };
        }
      } else {
        declare(declaration, undefined, filename);
      }
    }
  }
  for (const build of topLevelBuilds) build();
  for (const build of namespaceBuilds) build();

  return { symbolTable: { topLevel }, diagnostics };
}

interface BuildContext {
  readonly topLevel: TopLevelScope;
  readonly sources: PslSources;
  readonly diagnostics: ParseDiagnostic[];
}

function buildModel(
  name: string,
  node: ModelDeclarationAst,
  namespace: NamespaceSymbol | undefined,
  context: BuildContext,
): ModelSymbol {
  const owner = { name, keyword: 'model', hasFields: true, isMixin: false, namespace };
  const { fields, attributes, inclusions } = buildBody(owner, node, context);
  const span = nodePslSpan(node.syntax, context.sources);
  return { kind: 'model', name, node, span, fields, attributes, inclusions };
}

function buildCompositeType(
  name: string,
  node: CompositeTypeDeclarationAst,
  namespace: NamespaceSymbol | undefined,
  context: BuildContext,
): CompositeTypeSymbol {
  const owner = { name, keyword: 'type', hasFields: true, isMixin: false, namespace };
  const { fields, attributes, inclusions } = buildBody(owner, node, context);
  const span = nodePslSpan(node.syntax, context.sources);
  return { kind: 'compositeType', name, node, span, fields, attributes, inclusions };
}

function buildBlock(
  name: string,
  node: GenericBlockDeclarationAst,
  namespace: NamespaceSymbol | undefined,
  context: BuildContext,
): BlockSymbol {
  const keyword = node.keyword()?.text ?? '';
  const owner = { name, keyword, hasFields: false, isMixin: false, namespace };
  const { entries, attributes, inclusions } = buildBody(owner, node, context);
  const span = nodePslSpan(node.syntax, context.sources);
  return { kind: 'block', name, keyword, node, span, entries, attributes, inclusions };
}

const FIELD_BLOCK_KEYWORDS: ReadonlySet<string> = new Set(['model', 'type']);

function buildMixin(name: string, node: MixinDeclarationAst, context: BuildContext): MixinSymbol {
  const keyword = node.keyword()?.text ?? '';
  const hasFields = FIELD_BLOCK_KEYWORDS.has(keyword);
  const owner = { name, keyword, hasFields, isMixin: true, namespace: undefined };
  const { fields, entries, attributes } = buildBody(owner, node, context);
  const span = nodePslSpan(node.syntax, context.sources);
  return { kind: 'mixin', name, keyword, node, span, fields, entries, attributes };
}

interface BodyOwner {
  readonly name: string;
  readonly keyword: string;
  readonly hasFields: boolean;
  readonly isMixin: boolean;
  readonly namespace: NamespaceSymbol | undefined;
}

interface BodyNode {
  membersWithInclusions(): Iterable<
    FieldDeclarationAst | KeyValuePairAst | ModelAttributeAst | MixinInclusionAst
  >;
}

interface Body {
  readonly fields: Record<string, FieldSymbol>;
  readonly entries: KeyValuePairAst[];
  readonly attributes: ResolvedAttribute<ModelAttributeAst>[];
  readonly inclusions: ResolvedInclusion[];
}

function buildBody(owner: BodyOwner, node: BodyNode, context: BuildContext): Body {
  const { sources, diagnostics } = context;
  const body: Body = { fields: Object.create(null), entries: [], attributes: [], inclusions: [] };
  const included = new Set<MixinSymbol>();

  const addField = (
    name: string,
    symbol: () => FieldSymbol,
    duplicate: () => ParseDiagnostic | undefined,
  ): void => {
    if (!Object.hasOwn(body.fields, name)) {
      body.fields[name] = symbol();
      return;
    }
    const diagnostic = duplicate();
    if (diagnostic !== undefined) diagnostics.push(diagnostic);
  };

  for (const member of node.membersWithInclusions()) {
    if (member instanceof FieldDeclarationAst) {
      const nameNode = member.name();
      const name = nameNode?.name();
      if (!owner.hasFields || nameNode === undefined || name === undefined) continue;
      addField(
        name,
        () => buildField(owner.name, name, member, sources, diagnostics),
        () =>
          duplicateDeclaration(
            name,
            nameNode,
            sources.sourceFileFor(member.syntax).filename,
            sources,
          ),
      );
    } else if (member instanceof KeyValuePairAst) {
      if (!owner.hasFields) body.entries.push(member);
    } else if (member instanceof ModelAttributeAst) {
      body.attributes.push(readResolvedAttribute(member, sources));
    } else {
      const mixin = resolveInclusion(member, owner, body.inclusions, included, context);
      if (mixin === undefined) continue;
      const provides = (provided: string): ParseDiagnostic =>
        inclusionDiagnostic(
          'PSL_DUPLICATE_DECLARATION',
          `Mixin "${mixin.name}" provides "${provided}", which "${owner.name}" already has`,
          member,
          sources,
        );
      for (const field of Object.values(mixin.fields)) {
        addField(
          field.name,
          () => field,
          () => provides(field.name),
        );
      }
      const present = new Set(body.entries.map((entry) => entry.key()?.name()));
      for (const entry of mixin.entries) {
        const key = entry.key()?.name();
        if (key !== undefined && present.has(key)) diagnostics.push(provides(key));
        else body.entries.push(entry);
      }
      body.attributes.push(...mixin.attributes);
    }
  }
  return body;
}

function resolveInclusion(
  inclusion: MixinInclusionAst,
  owner: BodyOwner,
  inclusions: ResolvedInclusion[],
  included: Set<MixinSymbol>,
  context: BuildContext,
): MixinSymbol | undefined {
  const { topLevel, sources, diagnostics } = context;
  const reference = inclusion.name();
  if (reference === undefined) return undefined;
  const memberCode = owner.hasFields
    ? 'PSL_INVALID_MODEL_MEMBER'
    : 'PSL_INVALID_EXTENSION_BLOCK_MEMBER';
  const report = (code: string, message: string): undefined => {
    diagnostics.push(inclusionDiagnostic(code, message, inclusion, sources));
  };
  if (owner.isMixin) return report(memberCode, 'A mixin cannot include another mixin');

  const name = reference.identifier()?.name();
  if (name === undefined || reference.isOverQualified()) return undefined;
  const namespaceId = reference.namespace()?.name();
  const qualifier = namespaceId === undefined ? undefined : topLevel.namespaces[namespaceId];
  const resolution =
    reference.space() === undefined
      ? lookupMixinReference(topLevel, owner.namespace, { namespaceId, name })
      : undefined;
  inclusions.push({ node: inclusion, mixin: resolution, qualifier });
  if (resolution === undefined) {
    const written = printSyntax(reference.syntax);
    return report(PSL_UNRESOLVED_REFERENCE, `Cannot find mixin "${written}"`);
  }
  const mixin = resolution.symbol;
  if (mixin.keyword !== owner.keyword) {
    return report(
      memberCode,
      `Mixin "${mixin.name}" is for "${mixin.keyword}" blocks, not "${owner.keyword}" blocks`,
    );
  }
  if (included.has(mixin)) {
    return report(memberCode, `Mixin "${mixin.name}" is already included in this block`);
  }
  included.add(mixin);
  return mixin;
}

function inclusionDiagnostic(
  code: string,
  message: string,
  inclusion: MixinInclusionAst,
  sources: PslSources,
): ParseDiagnostic {
  return {
    code,
    message,
    filename: sources.sourceFileFor(inclusion.syntax).filename,
    range: nodeRange(inclusion.syntax, sources),
  };
}

function duplicateDeclaration(
  name: string,
  node: IdentifierAst,
  filename: string,
  sources: PslSources,
): ParseDiagnostic | undefined {
  const range = nameRange(node, sources);
  if (range === undefined) return undefined;
  return {
    code: 'PSL_DUPLICATE_DECLARATION',
    message: `Duplicate declaration of "${name}"`,
    filename,
    range,
  };
}

function buildField(
  ownerName: string,
  name: string,
  node: FieldDeclarationAst,
  sources: PslSources,
  diagnostics: ParseDiagnostic[],
): FieldSymbol {
  const attributes = readResolvedAttributes(node.attributes(), sources);
  const span = nodePslSpan(node.syntax, sources);
  const annotation = node.typeAnnotation();
  const typeName = annotation?.name();

  if (typeName?.isOverQualified()) {
    const path = typeName.path();
    diagnostics.push({
      code: 'PSL_INVALID_QUALIFIED_TYPE',
      message: `Field "${ownerName}.${name}" has an invalid qualified type "${path.join('.')}"; use at most one namespace qualifier (e.g. "ns.TypeName")`,
      filename: sources.sourceFileFor(typeName.syntax).filename,
      range: nodeRange(typeName.syntax, sources),
    });
    return {
      kind: 'field',
      name,
      node,
      span,
      typeName: path[path.length - 1] ?? '',
      optional: false,
      list: false,
      elementOptional: false,
      malformedType: true,
      attributes,
    };
  }

  const typeConstructor = annotation?.isConstructor()
    ? readResolvedConstructorCall(annotation, sources)
    : undefined;
  const typeNamespaceId = typeName?.namespace()?.name();
  const typeContractSpaceId = typeName?.space()?.name();

  return {
    kind: 'field',
    name,
    node,
    span,
    typeName: typeName?.identifier()?.name() ?? '',
    ...(typeNamespaceId !== undefined ? { typeNamespaceId } : {}),
    ...(typeContractSpaceId !== undefined ? { typeContractSpaceId } : {}),
    optional: annotation?.isOptional() ?? false,
    list: annotation?.isList() ?? false,
    elementOptional: annotation?.isElementOptional() ?? false,
    ...(typeConstructor !== undefined ? { typeConstructor } : {}),
    attributes,
  };
}

function resolveNamedTypeBinding(
  node: NamedTypeDeclarationAst,
  sources: PslSources,
): {
  baseType?: string;
  typeConstructor?: ResolvedTypeConstructorCall;
  isConstructor: boolean;
  attributes: readonly ResolvedAttribute<FieldAttributeAst>[];
} {
  const annotation = node.typeAnnotation();
  const isConstructor = annotation?.isConstructor() ?? false;
  const baseType = annotation?.name()?.identifier()?.name();
  const typeConstructor = readResolvedConstructorCall(annotation, sources);
  return {
    isConstructor,
    ...(!isConstructor && baseType !== undefined ? { baseType } : {}),
    ...(typeConstructor !== undefined ? { typeConstructor } : {}),
    attributes: readResolvedAttributes(node.attributes(), sources),
  };
}

function nameRange(name: IdentifierAst | undefined, sources: PslSources): Range | undefined {
  if (name === undefined) return undefined;
  const sourceFile = sources.sourceFileFor(name.syntax);
  for (const token of name.syntax.tokens()) {
    if (token.kind === 'Ident') {
      return {
        start: sourceFile.positionAt(token.offset),
        end: sourceFile.positionAt(token.offset + token.text.length),
      };
    }
  }
  return undefined;
}

function nodeRange(node: SyntaxNode, sources: PslSources): Range {
  const sourceFile = sources.sourceFileFor(node);
  const start = node.offset;
  const end = start + node.green.textLength;
  return {
    start: sourceFile.positionAt(start),
    end: sourceFile.positionAt(end),
  };
}
