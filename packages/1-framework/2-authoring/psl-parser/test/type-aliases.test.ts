import type {
  AuthoringFieldPresetDescriptor,
  AuthoringTypeConstructorDescriptor,
} from '@internal/framework-components/authoring';
import { EMPTY_GENERATOR_FUNCTIONS } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { EMPTY_DATA_TYPES, typeAttributeSubjectLabel } from '../src/attribute-spec/spec-context';
import { type BinderContext, createBinder } from '../src/binder';
import { contributedTypeCodecId } from '../src/contributed-type-scope';
import { createPslDiagnosticCollector } from '../src/diagnostic';
import { parse } from '../src/parse';
import { PslSources } from '../src/source-file';
import { buildSymbolTable } from '../src/symbol-table';
import {
  refuseRepeatedTypeAliasAttributes,
  resolveTypeAliases,
  typeAliasOfField,
  typeAliasSpecContext,
} from '../src/type-aliases';

const text: AuthoringTypeConstructorDescriptor = {
  kind: 'typeConstructor',
  output: { codecId: 'fixture/text@1' },
};

const varchar: AuthoringTypeConstructorDescriptor = {
  kind: 'typeConstructor',
  args: [{ kind: 'number', name: 'length' }],
  output: { codecId: 'fixture/varchar@1' },
};

const createdAt: AuthoringFieldPresetDescriptor = {
  kind: 'fieldPreset',
  output: { codecId: 'fixture/timestamp@1' },
};

function context(): BinderContext {
  return {
    authoringContributions: {
      type: { String: text, VarChar: varchar },
      field: { temporal: { createdAt } },
      entityTypes: {},
      attributeSpecs: { model: {}, field: {} },
      modelAttributes: {},
      pslBlockDescriptors: {},
      dataTypes: {},
    },
    controlMutationDefaults: { defaultFunctionRegistry: new Map() },
    generatorFunctions: EMPTY_GENERATOR_FUNCTIONS,
    dataTypes: EMPTY_DATA_TYPES,
  };
}

type ResolveOptions = Pick<
  Parameters<typeof resolveTypeAliases>[0],
  'describeUnsupportedAttribute' | 'acceptedAttributes'
>;

function resolve(schema: string, options: ResolveOptions = {}) {
  const { document, sources } = parse(schema, 'schema.prisma');
  const pslSources = new PslSources([[document.syntax, sources.sourceFileFor(document.syntax)]]);
  const { symbolTable } = buildSymbolTable({
    documents: [document],
    sources: pslSources,
    defaultNamespaceId: 'public',
  });
  const { binder } = createBinder({ symbolTable, sources: pslSources, context: context() });
  const diagnostics = createPslDiagnosticCollector(pslSources);
  const aliases = resolveTypeAliases({
    declarations: Object.values(symbolTable.namedTypes),
    binder,
    sources: pslSources,
    diagnostics,
    typeNoun: 'column type',
    ...options,
  });
  const reported = () =>
    diagnostics.toExternal().map(({ code, message, span }) => ({
      code,
      message,
      line: span?.start.line,
    }));
  return { aliases, symbolTable, binder, sources: pslSources, diagnostics, reported };
}

describe('resolveTypeAliases', () => {
  it('reads a called constructor, a bare constructor and a block as a base, keeping the attributes a field takes', () => {
    const { aliases, symbolTable, reported } = resolve(`enum Role {
  User
}

types {
  Slug  = VarChar(64) @default("a") @onCreate(f()) @onUpdate(f())
  Name  = String
  Roles = Role
}`);
    const { Slug, Name, Roles } = symbolTable.namedTypes;
    expect(reported()).toEqual([]);
    expect({
      slug: Slug === undefined ? undefined : aliases.get(Slug),
      name: Name === undefined ? undefined : aliases.get(Name),
      roles: Roles === undefined ? undefined : aliases.get(Roles),
    }).toMatchObject({
      slug: {
        base: { kind: 'typeConstructor', descriptor: varchar, call: { path: ['VarChar'] } },
        baseName: 'VarChar',
        attributes: [{ name: 'default' }, { name: 'onCreate' }, { name: 'onUpdate' }],
      },
      name: { base: { kind: 'typeConstructor', descriptor: text, call: undefined } },
      roles: { base: { kind: 'block', symbol: { name: 'Role' } }, baseName: 'Role' },
    });
  });

  it('refuses a base that is another alias, a preset, a constructor that needs arguments, or missing', () => {
    const { aliases, reported } = resolve(`types {
  A = String
  B = A
  C = temporal.createdAt()
  D = VarChar
  E = Missing()
}`);
    expect({ resolved: aliases.size, reported: reported() }).toEqual({
      resolved: 1,
      reported: [
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
          message: 'Named type "B" references unsupported base type "A"',
          line: 3,
        },
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR',
          message: 'Named type "C" references unsupported constructor "temporal.createdAt"',
          line: 4,
        },
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
          message: 'Named type "D" references unsupported base type "VarChar"',
          line: 5,
        },
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR',
          message: 'Named type "E" references unsupported constructor "Missing"',
          line: 6,
        },
      ],
    });
  });

  it('refuses and drops any other attribute, keeping the alias, in the family wording when it gives one', () => {
    const { aliases, reported } = resolve(
      `types {
  Slug = String @map("x") @db.Text
}`,
      {
        describeUnsupportedAttribute: (attribute, declaration) =>
          attribute.name === 'db.Text' ? `${declaration.name} takes no @db.Text` : undefined,
      },
    );
    expect({
      attributes: [...aliases.values()].map((alias) => alias.attributes),
      reported: reported(),
    }).toEqual({
      attributes: [[]],
      reported: [
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
          message: 'Named type "Slug" uses unsupported attribute "map"',
          line: 2,
        },
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
          message: 'Slug takes no @db.Text',
          line: 2,
        },
      ],
    });
  });

  it('refuses @id and @unique, which belong on a field, in every family', () => {
    const { reported } = resolve(
      `types {
  Key = String @id @unique
}`,
      { describeUnsupportedAttribute: () => 'family wording' },
    );
    expect(reported()).toEqual([
      {
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
        message:
          'Type alias "Key" cannot carry @id. @id and @unique describe a model\'s field, not a column type; write them on the field.',
        line: 2,
      },
      {
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
        message:
          'Type alias "Key" cannot carry @unique. @id and @unique describe a model\'s field, not a column type; write them on the field.',
        line: 2,
      },
    ]);
  });

  it('keeps only the attributes the family accepts', () => {
    const { aliases, reported } = resolve(
      `types {
  Stamp = String @default("x") @onCreate(now())
}`,
      { acceptedAttributes: new Set(['onCreate', 'onUpdate']) },
    );
    expect({
      attributes: [...aliases.values()].map((alias) => alias.attributes.map(({ name }) => name)),
      reported: reported(),
    }).toEqual({
      attributes: [['onCreate']],
      reported: [
        {
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
          message: 'Named type "Stamp" uses unsupported attribute "default"',
          line: 2,
        },
      ],
    });
  });
});

describe('a field typed by a type alias', () => {
  const schema = `types {
  Slug = VarChar(64) @default("a")
}

model Post {
  slug  Slug @default("b") @unique
  title String
}`;

  it('finds its alias, and reads the alias attributes in a context named for the alias', () => {
    const { aliases, symbolTable, binder } = resolve(schema);
    const fields = symbolTable.defaultNamespace.models['Post']?.fields;
    const slug = fields?.['slug'];
    const title = fields?.['title'];
    const alias = slug === undefined ? undefined : typeAliasOfField(slug, binder, aliases);
    const context =
      alias === undefined
        ? undefined
        : typeAliasSpecContext(alias, {
            symbols: symbolTable,
            binder,
            defaultFunctionRegistry: new Map(),
            generatorFunctions: EMPTY_GENERATOR_FUNCTIONS,
            dataTypes: EMPTY_DATA_TYPES,
          });
    expect({
      alias: alias?.symbol.name,
      untyped: title === undefined ? undefined : typeAliasOfField(title, binder, aliases),
      subject: context === undefined ? undefined : typeAttributeSubjectLabel(context.subject),
      list: context?.list,
      typeName: context?.typeName,
      codecId:
        context?.typeConstructor === undefined
          ? undefined
          : contributedTypeCodecId(context.typeConstructor.descriptor),
    }).toEqual({
      alias: 'Slug',
      untyped: undefined,
      subject: 'Type alias "Slug"',
      list: false,
      typeName: 'VarChar',
      codecId: 'fixture/varchar@1',
    });
  });

  it('is refused for each attribute it repeats from its alias, and may add others', () => {
    const { aliases, symbolTable, binder, sources, diagnostics, reported } = resolve(schema);
    const slug = symbolTable.defaultNamespace.models['Post']?.fields['slug'];
    const alias = slug === undefined ? undefined : typeAliasOfField(slug, binder, aliases);
    const refused =
      slug !== undefined &&
      alias !== undefined &&
      refuseRepeatedTypeAliasAttributes({
        field: slug,
        fieldPath: 'Post.slug',
        alias,
        sources,
        diagnostics,
      });
    expect({ refused, reported: reported() }).toEqual({
      refused: true,
      reported: [
        {
          code: 'PSL_DUPLICATE_ATTRIBUTE',
          message:
            'Field "Post.slug" writes @default, which its type alias "Slug" already sets. Remove one of them.',
          line: 6,
        },
      ],
    });
  });
});
