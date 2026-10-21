import type {
  AuthoringTypeAliasDescriptor,
  AuthoringTypeConstructorDescriptor,
  DataTypeSupport,
} from '@internal/framework-components/authoring';
import type { GeneratorFunctionRegistry } from '@internal/framework-components/components';
import type { ControlMutationDefaultRegistry } from '@internal/framework-components/control';
import type { TypeAttributeSpecContext } from './attribute-spec/spec-context';
import { type Binder, contributedTypeOf, type Resolution, typeReferenceNode } from './binder';
import { diagnosticSource, type PslDiagnosticCollector } from './diagnostic';
import type { PslSources } from './source-file';
import type {
  BlockSymbol,
  FieldSymbol,
  NamedTypeSymbol,
  ResolvedAttribute,
  ResolvedTypeConstructorCall,
  SymbolTable,
} from './symbol-table';
import type { FieldAttributeAst } from './syntax/ast/attributes';
import { isBareTypeConstructor } from './type-constructor-calls';

/** The attributes a type alias may carry. Every field typed by the alias takes them. */
export const TYPE_ALIAS_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set([
  'default',
  'onCreate',
  'onUpdate',
]);

/** What a type alias is written as: a type constructor, called or bare, or a block such as an enum, which its family reads. */
export type TypeAliasBase =
  | {
      readonly kind: 'typeConstructor';
      readonly descriptor: AuthoringTypeConstructorDescriptor;
      /** `undefined` when the constructor is written bare. */
      readonly call: ResolvedTypeConstructorCall | undefined;
    }
  | { readonly kind: 'block'; readonly symbol: BlockSymbol };

/** A `types {}` declaration read as a type alias: its base, one level deep, and the attributes its fields take. */
export interface TypeAlias {
  readonly symbol: NamedTypeSymbol;
  readonly base: TypeAliasBase;
  /** The base as written, such as `VarChar(64)`'s `VarChar` or an enum's name. */
  readonly baseName: string;
  readonly baseResolution: Resolution;
  /** The alias's `@default`, `@onCreate` and `@onUpdate`. */
  readonly attributes: readonly ResolvedAttribute<FieldAttributeAst>[];
}

function writtenBase(declaration: NamedTypeSymbol, sources: PslSources): string {
  const node = typeReferenceNode(declaration);
  if (node === undefined) return declaration.baseType ?? '';
  return sources.sourceFileFor(node).text.slice(node.offset, node.endOffset).trim();
}

function baseOf(
  declaration: NamedTypeSymbol,
  resolution: Resolution | undefined,
): TypeAliasBase | undefined {
  if (resolution?.kind === 'block' && !declaration.isConstructor) {
    return { kind: 'block', symbol: resolution.symbol };
  }
  if (resolution?.kind !== 'contributedType') return undefined;
  const { descriptor } = resolution.symbol;
  if (descriptor.kind !== 'typeConstructor') return undefined;
  if (declaration.isConstructor) {
    return { kind: 'typeConstructor', descriptor, call: declaration.typeConstructor };
  }
  return isBareTypeConstructor(descriptor)
    ? { kind: 'typeConstructor', descriptor, call: undefined }
    : undefined;
}

function fieldOnlyAttributeMessage(
  attribute: ResolvedAttribute<FieldAttributeAst>,
  declaration: NamedTypeSymbol,
): string | undefined {
  return attribute.name === 'id' || attribute.name === 'unique'
    ? `Type alias "${declaration.name}" cannot carry @${attribute.name}. @id and @unique describe a model's field, not a column type; write them on the field.`
    : undefined;
}

/**
 * Reads each `types {}` declaration as a type alias. A base must be a type constructor or a block; another alias, a field preset or anything else is refused, as is an alias with no base. Of the attributes, those the family accepts are kept and every other one is refused and dropped, keeping the alias, so its fields are not refused for it too.
 */
export function resolveTypeAliases(input: {
  readonly declarations: readonly NamedTypeSymbol[];
  readonly binder: Binder;
  readonly sources: PslSources;
  readonly diagnostics: PslDiagnosticCollector;
  /** The attributes the family lets a type alias carry; `TYPE_ALIAS_ATTRIBUTE_NAMES` by default. */
  readonly acceptedAttributes?: ReadonlySet<string>;
  /** The family's wording for an attribute no type alias takes, or `undefined` for the shared wording. */
  readonly describeUnsupportedAttribute?: (
    attribute: ResolvedAttribute<FieldAttributeAst>,
    declaration: NamedTypeSymbol,
  ) => string | undefined;
}): Map<NamedTypeSymbol, TypeAlias> {
  const aliases = new Map<NamedTypeSymbol, TypeAlias>();
  const accepted = input.acceptedAttributes ?? TYPE_ALIAS_ATTRIBUTE_NAMES;
  for (const declaration of input.declarations) {
    const source = diagnosticSource(input.sources, declaration.node.syntax);
    const refuseBase = (code: string, message: string, span = declaration.span) =>
      input.diagnostics.push({ code, message, ...source.at(span) });
    const reference = typeReferenceNode(declaration);
    const resolution = reference === undefined ? undefined : input.binder.symbolForNode(reference);
    const written = declaration.isConstructor ? declaration.typeConstructor : declaration.baseType;
    if (written === undefined) {
      refuseBase(
        'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
        `Named type "${declaration.name}" must declare a base type or constructor`,
      );
      continue;
    }
    const base = baseOf(declaration, resolution);
    if (base === undefined || resolution === undefined) {
      if (declaration.typeConstructor !== undefined) {
        refuseBase(
          'PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR',
          `Named type "${declaration.name}" references unsupported constructor "${declaration.typeConstructor.path.join('.')}"`,
          declaration.typeConstructor.span,
        );
      } else {
        refuseBase(
          'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
          `Named type "${declaration.name}" references unsupported base type "${writtenBase(declaration, input.sources)}"`,
        );
      }
      continue;
    }

    const attributes: ResolvedAttribute<FieldAttributeAst>[] = [];
    for (const attribute of declaration.attributes) {
      if (accepted.has(attribute.name)) {
        attributes.push(attribute);
        continue;
      }
      const message =
        fieldOnlyAttributeMessage(attribute, declaration) ??
        input.describeUnsupportedAttribute?.(attribute, declaration) ??
        `Named type "${declaration.name}" uses unsupported attribute "${attribute.name}"`;
      input.diagnostics.push({
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
        message,
        ...source.at(attribute.span),
      });
    }

    aliases.set(declaration, {
      symbol: declaration,
      base,
      baseName: declaration.baseType ?? writtenBase(declaration, input.sources),
      baseResolution: resolution,
      attributes,
    });
  }
  return aliases;
}

/** A type alias a pack contributes, such as `temporal.CreatedAt`. */
export interface ContributedTypeAlias {
  /** The alias's path, as a field writes it. */
  readonly name: string;
  readonly descriptor: AuthoringTypeAliasDescriptor;
}

/** The contributed type alias a type reference resolves to, if it resolves to one. */
export function contributedTypeAliasOf(
  resolution: Resolution | undefined,
): ContributedTypeAlias | undefined {
  if (resolution?.kind !== 'contributedType') return undefined;
  const { descriptor, path } = resolution.symbol;
  return descriptor.kind === 'typeAlias' ? { name: path.join('.'), descriptor } : undefined;
}

/** The names of the attributes a type alias sets for every field typed by it. */
export function typeAliasAttributeNames(
  alias: TypeAlias | ContributedTypeAlias,
): ReadonlySet<string> {
  if ('symbol' in alias) return new Set(alias.attributes.map(({ name }) => name));
  const { default: columnDefault, onCreate, onUpdate } = alias.descriptor.output;
  return new Set(
    Object.entries({ default: columnDefault, onCreate, onUpdate }).flatMap(([name, value]) =>
      value === undefined ? [] : [name],
    ),
  );
}

/** The type alias a field is typed by, if it is typed by one. */
export function typeAliasOfField(
  field: FieldSymbol,
  binder: Binder,
  aliases: ReadonlyMap<NamedTypeSymbol, TypeAlias>,
): TypeAlias | undefined {
  const node = typeReferenceNode(field);
  const resolution = node === undefined ? undefined : binder.symbolForNode(node);
  return resolution?.kind === 'namedType' ? aliases.get(resolution.symbol) : undefined;
}

/** The spec context the attributes a type alias carries are read in, as a field's are read in its own. */
export function typeAliasSpecContext(
  alias: TypeAlias,
  input: {
    readonly symbols: SymbolTable;
    readonly binder: Binder;
    readonly defaultFunctionRegistry: ControlMutationDefaultRegistry;
    readonly generatorFunctions: GeneratorFunctionRegistry;
    readonly dataTypes: DataTypeSupport;
  },
): TypeAttributeSpecContext {
  return {
    symbols: input.symbols,
    defaultFunctionRegistry: input.defaultFunctionRegistry,
    generatorFunctions: input.generatorFunctions,
    dataTypes: input.dataTypes,
    subject: { kind: 'type alias', name: alias.symbol.name },
    list: false,
    typeName: alias.baseName,
    typeResolution: alias.baseResolution,
    typeConstructor: contributedTypeOf(alias.baseResolution, input.binder),
  };
}

/**
 * Refuses each attribute a field writes that its type alias already carries, at the field's attribute. Returns whether it refused any.
 */
export function refuseRepeatedTypeAliasAttributes(input: {
  readonly field: FieldSymbol;
  /** `Model.field`. */
  readonly fieldPath: string;
  readonly alias: TypeAlias | ContributedTypeAlias;
  readonly sources: PslSources;
  readonly diagnostics: PslDiagnosticCollector;
}): boolean {
  const carried = typeAliasAttributeNames(input.alias);
  const aliasName = 'symbol' in input.alias ? input.alias.symbol.name : input.alias.name;
  const repeated = input.field.attributes.filter(({ name }) => carried.has(name));
  const source = diagnosticSource(input.sources, input.field.node.syntax);
  for (const attribute of repeated) {
    input.diagnostics.push({
      code: 'PSL_DUPLICATE_ATTRIBUTE',
      message: `Field "${input.fieldPath}" writes @${attribute.name}, which its type alias "${aliasName}" already sets. Remove one of them.`,
      ...source.at(attribute.span),
    });
  }
  return repeated.length > 0;
}
