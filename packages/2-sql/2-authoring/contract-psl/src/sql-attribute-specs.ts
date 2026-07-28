import type { ContractSourceDiagnostic } from '@prisma-next/config/config-types';
import type { ControlMutationDefaultRegistry } from '@prisma-next/framework-components/control';
import type {
  ContributedPslDiagnosticCode,
  PslDiagnostic,
} from '@prisma-next/framework-components/psl-ast';
import type {
  ArgType,
  AttributeSpec,
  FieldSymbol,
  FuncCallSig,
  InterpretCtx,
  ModelSymbol,
  TypedFuncCall,
} from '@prisma-next/psl-parser';
import {
  bool,
  entityRef,
  fieldAttribute,
  fieldRef,
  funcCall,
  identifier,
  interpretAttribute,
  leafDiagnostic,
  list,
  modelAttribute,
  num,
  oneOf,
  optional,
  record,
  str,
} from '@prisma-next/psl-parser';
import type {
  FieldAttributeAst,
  ModelAttributeAst,
  SourceFile,
} from '@prisma-next/psl-parser/syntax';
import { blindCast } from '@prisma-next/utils/casts';

export function findModelAttributeNode(
  model: ModelSymbol,
  name: string,
): ModelAttributeAst | undefined {
  for (const attribute of model.node.attributes()) {
    if (attribute.name()?.isSimpleName(name) === true) return attribute;
  }
  return undefined;
}

export function findFieldAttributeNode(
  field: FieldSymbol,
  name: string,
): FieldAttributeAst | undefined {
  for (const attribute of field.node.attributes()) {
    if (attribute.name()?.isSimpleName(name) === true) return attribute;
  }
  return undefined;
}

function buildModelInterpretCtx(input: {
  readonly selfModel: ModelSymbol;
  readonly sourceFile: SourceFile;
  readonly sourceId: string;
}): InterpretCtx {
  return {
    level: 'model',
    sourceId: input.sourceId,
    sourceFile: input.sourceFile,
    selfModel: input.selfModel,
    resolveReferencedModel: () => undefined,
  };
}

function buildFieldInterpretCtx(input: {
  readonly selfModel: ModelSymbol;
  readonly field: FieldSymbol;
  readonly sourceFile: SourceFile;
  readonly sourceId: string;
  readonly resolveReferencedModel?: (() => ModelSymbol | undefined) | undefined;
}): InterpretCtx {
  return {
    level: 'field',
    sourceId: input.sourceId,
    sourceFile: input.sourceFile,
    selfModel: input.selfModel,
    resolveReferencedModel: input.resolveReferencedModel ?? (() => undefined),
    field: input.field,
  };
}

// Interpret a model-level attribute node against its spec, draining any parse
// failures into `diagnostics`. Returns the typed value, or `undefined` on
// failure so the caller can apply its own default/absence handling.
export function interpretModelAttribute<Out>(input: {
  readonly node: ModelAttributeAst;
  readonly spec: AttributeSpec<Out>;
  readonly model: ModelSymbol;
  readonly sourceFile: SourceFile;
  readonly sourceId: string;
  readonly diagnostics: ContractSourceDiagnostic[];
}): Out | undefined {
  const result = interpretAttribute(
    input.node,
    input.spec,
    buildModelInterpretCtx({
      selfModel: input.model,
      sourceFile: input.sourceFile,
      sourceId: input.sourceId,
    }),
  );
  if (!result.ok) {
    for (const failure of result.failure) input.diagnostics.push(failure);
    return undefined;
  }
  return result.value;
}

// Interpret a field-level attribute node against its spec, draining any parse
// failures into `diagnostics`. Returns the typed value, or `undefined` on
// failure so the caller can apply its own default/absence handling.
export function interpretFieldAttribute<Out>(input: {
  readonly node: FieldAttributeAst;
  readonly spec: AttributeSpec<Out>;
  readonly model: ModelSymbol;
  readonly field: FieldSymbol;
  readonly sourceFile: SourceFile;
  readonly sourceId: string;
  readonly diagnostics: ContractSourceDiagnostic[];
  readonly resolveReferencedModel?: () => ModelSymbol | undefined;
}): Out | undefined {
  const result = interpretAttribute(
    input.node,
    input.spec,
    buildFieldInterpretCtx({
      selfModel: input.model,
      field: input.field,
      sourceFile: input.sourceFile,
      sourceId: input.sourceId,
      resolveReferencedModel: input.resolveReferencedModel,
    }),
  );
  if (!result.ok) {
    for (const failure of result.failure) input.diagnostics.push(failure);
    return undefined;
  }
  return result.value;
}

export const mapModelSpec = modelAttribute('map', { positional: [{ key: 'name', type: str() }] });
export const mapFieldSpec = fieldAttribute('map', { positional: [{ key: 'name', type: str() }] });

type DefaultArgValue = string | number | boolean | (string | number | boolean)[] | TypedFuncCall;

// Compose the non-enum `@default` value grammar for a single field: flexible literal arms
// (string/number/boolean), a list arm only for list fields, and one typed `funcCall(name, signature)`
// arm per registered default function. Field kind maps to shape, so an array on a scalar field
// (or a scalar on a list field) is invalid syntax.
export function buildDefaultSpec(input: {
  readonly isList: boolean;
  readonly registry: ControlMutationDefaultRegistry;
}) {
  const literal = () => oneOf(str(), num(), bool());
  const funcArms = [...input.registry.entries()].map(([name, entry]) =>
    funcCall(
      name,
      blindCast<
        FuncCallSig,
        'The registry stores each signature opaquely as `unknown` because FuncCallSig lives in the authoring layer that core cannot name; the SQL family owns these entries and guarantees every one declares a FuncCallSig.'
      >(entry.signature),
    ),
  );
  const valueArms: readonly [ArgType<DefaultArgValue>, ...ArgType<DefaultArgValue>[]] = input.isList
    ? [list(literal()), ...funcArms]
    : [str(), num(), bool(), ...funcArms];
  return fieldAttribute('default', { positional: [{ key: 'value', type: oneOf(...valueArms) }] });
}

// Compose the enum `@default` value grammar from the enum's own member names: one
// `identifier(member)` arm per member, so member-validity is a grammar concern — a non-member
// identifier fails `oneOf` as invalid attribute syntax.
export function buildEnumDefaultSpec(memberNames: readonly [string, ...string[]]) {
  const [first, ...rest] = memberNames;
  const arms: readonly [ArgType<string>, ...ArgType<string>[]] = [
    identifier(first),
    ...rest.map((name) => identifier(name)),
  ];
  return fieldAttribute('default', { positional: [{ key: 'member', type: oneOf(...arms) }] });
}

export const idFieldSpec = fieldAttribute('id', { named: { map: optional(str()) } });
export const uniqueFieldSpec = fieldAttribute('unique', { named: { map: optional(str()) } });

export const idModelSpec = modelAttribute('id', {
  positional: [{ key: 'fields', type: list(fieldRef('self'), { nonEmpty: true, unique: true }) }],
  named: { map: optional(str()) },
});
export const uniqueModelSpec = modelAttribute('unique', {
  positional: [{ key: 'fields', type: list(fieldRef('self'), { nonEmpty: true, unique: true }) }],
  named: { map: optional(str()) },
});

// `@@index` cross-argument diagnostic codes — contributed by this package
// through the family-neutral `ContributedPslDiagnosticCode` seam; the
// framework union stays free of index vocabulary.
export const PSL_INDEX_FIELDS_XOR_EXPRESSION: ContributedPslDiagnosticCode =
  'PSL_INDEX_FIELDS_XOR_EXPRESSION';
export const PSL_INDEX_EXPRESSION_REQUIRES_NAME: ContributedPslDiagnosticCode =
  'PSL_INDEX_EXPRESSION_REQUIRES_NAME';
export const PSL_INDEX_NAME_XOR_MAP: ContributedPslDiagnosticCode = 'PSL_INDEX_NAME_XOR_MAP';

export const indexModelSpec = modelAttribute('index', {
  positional: [
    { key: 'fields', type: optional(list(fieldRef('self'), { nonEmpty: true, unique: true })) },
  ],
  named: {
    expression: optional(str()),
    where: optional(str()),
    unique: optional(bool()),
    name: optional(str()),
    map: optional(str()),
    type: optional(str()),
    options: optional(record(str())),
  },
  refine: (value, ctx, attributeNode) => {
    const diagnostics: PslDiagnostic[] = [];
    if ((value.fields === undefined) === (value.expression === undefined)) {
      diagnostics.push(
        leafDiagnostic(
          ctx,
          attributeNode,
          '`@@index` requires exactly one of a fields list or an `expression` argument',
          PSL_INDEX_FIELDS_XOR_EXPRESSION,
        ),
      );
    }
    if (value.expression !== undefined && value.name === undefined && value.map === undefined) {
      diagnostics.push(
        leafDiagnostic(
          ctx,
          attributeNode,
          '`@@index` with an `expression` argument requires a `name` or `map` argument (a default name cannot be derived from an expression)',
          PSL_INDEX_EXPRESSION_REQUIRES_NAME,
        ),
      );
    }
    if (value.name !== undefined && value.map !== undefined) {
      diagnostics.push(
        leafDiagnostic(
          ctx,
          attributeNode,
          '`@@index` takes at most one of `name` and `map`',
          PSL_INDEX_NAME_XOR_MAP,
        ),
      );
    }
    if (value.options !== undefined && value.type === undefined) {
      diagnostics.push(
        leafDiagnostic(ctx, attributeNode, '`@@index` options argument requires a type argument'),
      );
    }
    return diagnostics;
  },
});

export const controlModelSpec = modelAttribute('control', {
  positional: [
    {
      key: 'policy',
      type: oneOf(
        identifier('managed'),
        identifier('tolerated'),
        identifier('external'),
        identifier('observed'),
      ),
    },
  ],
});

export const discriminatorModelSpec = modelAttribute('discriminator', {
  positional: [{ key: 'field', type: fieldRef('self') }],
});
export const baseModelSpec = modelAttribute('base', {
  positional: [
    { key: 'base', type: entityRef() },
    { key: 'value', type: str() },
  ],
});
