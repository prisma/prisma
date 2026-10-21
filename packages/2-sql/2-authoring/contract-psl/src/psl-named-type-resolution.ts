import type { ExecutionMutationDefaultPhases } from '@internal/contract/types';
import {
  type DataTypeSupport,
  instantiateAuthoringTypeConstructor,
} from '@internal/framework-components/authoring';
import type { CodecLookupWithDescriptors } from '@internal/framework-components/codec';
import type { GeneratorFunctionRegistry } from '@internal/framework-components/components';
import type { ControlMutationDefaultRegistry } from '@internal/framework-components/control';
import type {
  Binder,
  BlockSymbol,
  NamedTypeSymbol,
  PslDiagnosticCollector,
  ResolvedAttribute,
  SymbolTable,
  TypeAlias,
} from '@internal/psl-parser';
import { diagnosticSource, resolveTypeAliases, typeAliasSpecContext } from '@internal/psl-parser';
import type { FieldAttributeAst, PslSources } from '@internal/psl-parser/syntax';
import type {
  AuthoredColumnDefault,
  EnumTypeHandle,
} from '@internal/sql-contract-ts/contract-builder';
import { formatDbAttributeMigrationMessage } from './psl-attribute-parsing';
import {
  type ColumnDescriptor,
  instantiatePslTypeConstructor,
  lowerEnumDefault,
  lowerTypeDefault,
  lowerTypeGenerators,
  type TypeAttributeOwner,
} from './psl-column-resolution';

/** A type alias resolved once at its declaration: the column it gives each field typed by it, and the default and generators that column takes. */
export interface ResolvedTypeAlias {
  readonly alias: TypeAlias;
  readonly descriptor: ColumnDescriptor;
  readonly enumHandle: EnumTypeHandle | undefined;
  readonly defaultValue: AuthoredColumnDefault | undefined;
  readonly executionDefaults: ExecutionMutationDefaultPhases | undefined;
}

export interface ResolveNamedTypeDeclarationsInput {
  readonly declarations: readonly NamedTypeSymbol[];
  readonly sources: PslSources;
  readonly symbolTable: SymbolTable;
  readonly binder: Binder;
  readonly enumTypeDescriptors: ReadonlyMap<BlockSymbol, ColumnDescriptor>;
  readonly enumHandles: ReadonlyMap<BlockSymbol, EnumTypeHandle>;
  readonly codecLookup: CodecLookupWithDescriptors;
  readonly defaultFunctionRegistry: ControlMutationDefaultRegistry;
  readonly generatorFunctions: GeneratorFunctionRegistry;
  readonly dataTypes: DataTypeSupport;
  readonly diagnostics: PslDiagnosticCollector;
}

function describeUnsupportedSqlAliasAttribute(
  attribute: ResolvedAttribute<FieldAttributeAst>,
  declaration: NamedTypeSymbol,
): string | undefined {
  if (attribute.name === 'id' || attribute.name === 'unique') {
    return `Type alias "${declaration.name}" cannot carry @${attribute.name}. @id and @unique describe a model's field, not a column type; write them on the field.`;
  }
  return attribute.name.startsWith('db.')
    ? formatDbAttributeMigrationMessage(attribute)
    : undefined;
}

function aliasDescriptor(
  alias: TypeAlias,
  input: ResolveNamedTypeDeclarationsInput,
): ColumnDescriptor | undefined {
  const { base, symbol } = alias;
  const source = diagnosticSource(input.sources, symbol.node.syntax);
  if (base.kind === 'typeConstructor') {
    if (base.call === undefined) return instantiateAuthoringTypeConstructor(base.descriptor, []);
    return instantiatePslTypeConstructor({
      call: base.call,
      descriptor: base.descriptor,
      codecLookup: input.codecLookup,
      diagnostics: input.diagnostics,
      source,
      entityLabel: `Named type "${symbol.name}"`,
    });
  }
  const descriptor = input.enumTypeDescriptors.get(base.symbol);
  if (descriptor === undefined) {
    input.diagnostics.push({
      code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
      message: `Named type "${symbol.name}" references unsupported base type "${alias.baseName}"`,
      ...source.at(symbol.span),
    });
  }
  return descriptor;
}

/**
 * Resolves each `types {}` alias once: its column type, with the params inline, and its `@default`, `@onCreate` and `@onUpdate`, lowered for that column. A diagnostic about the alias is reported here, once, not at each field typed by it.
 */
export function resolveNamedTypeDeclarations(
  input: ResolveNamedTypeDeclarationsInput,
): Map<NamedTypeSymbol, ResolvedTypeAlias> {
  const aliases = resolveTypeAliases({
    declarations: input.declarations,
    binder: input.binder,
    sources: input.sources,
    diagnostics: input.diagnostics,
    describeUnsupportedAttribute: describeUnsupportedSqlAliasAttribute,
  });
  const resolved = new Map<NamedTypeSymbol, ResolvedTypeAlias>();
  for (const alias of aliases.values()) {
    const descriptor = aliasDescriptor(alias, input);
    if (descriptor === undefined) continue;
    const owner: TypeAttributeOwner = {
      attributes: alias.attributes,
      optional: false,
      list: false,
      elementOptional: false,
      specContext: typeAliasSpecContext(alias, { ...input, symbols: input.symbolTable }),
      loweringNames: { modelName: 'types', fieldName: alias.symbol.name },
    };
    const enumHandle =
      alias.base.kind === 'block' ? input.enumHandles.get(alias.base.symbol) : undefined;
    const lowering = { ...input, owner };
    const { defaultValue } =
      enumHandle === undefined
        ? lowerTypeDefault({
            ...lowering,
            columnDescriptor: descriptor,
            columnTypeParams: descriptor.typeParams,
            isListColumn: false,
            valueObjectDefault: undefined,
          })
        : lowerEnumDefault({ ...lowering, enumHandle });
    const executionDefaults = lowerTypeGenerators({
      ...lowering,
      columnDescriptor: descriptor,
      columnTypeParams: descriptor.typeParams,
    });
    resolved.set(alias.symbol, { alias, descriptor, enumHandle, defaultValue, executionDefaults });
  }
  return resolved;
}
