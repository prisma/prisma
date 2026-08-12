import { describe, expect, it } from 'vitest';
import { assembleAuthoringContributions } from '../src/control/control-stack';
import type { ComponentDescriptor } from '../src/shared/framework-components';

function createDescriptor(
  overrides: Partial<ComponentDescriptor<string>> = {},
): ComponentDescriptor<string> {
  return {
    kind: 'target',
    id: 'test',
    version: '0.0.1',
    ...overrides,
  } as ComponentDescriptor<string>;
}

function makeModelAttributeDescriptor(attribute: string) {
  return {
    kind: 'modelAttribute' as const,
    attribute,
    spec: {},
    lower: (_parsed: never, ctx: { readonly storageName: string }) => ({
      key: ctx.storageName,
      entity: { attribute },
    }),
  };
}

describe('assembleAuthoringContributions modelAttributes', () => {
  it('returns an empty modelAttributes namespace for descriptors without authoring', () => {
    const result = assembleAuthoringContributions([createDescriptor()]);
    expect(result.modelAttributes).toEqual({});
  });

  it('merges modelAttributes namespaces from multiple descriptors', () => {
    const result = assembleAuthoringContributions([
      createDescriptor({
        authoring: {
          modelAttributes: {
            audit: makeModelAttributeDescriptor('audit'),
          },
        },
      }),
      createDescriptor({
        id: 'other',
        authoring: {
          modelAttributes: {
            stamp: makeModelAttributeDescriptor('stamp'),
          },
        },
      }),
    ]);
    expect(Object.keys(result.modelAttributes)).toEqual(['audit', 'stamp']);
  });

  it('throws on duplicate modelAttributes paths from different descriptors', () => {
    expect(() =>
      assembleAuthoringContributions([
        createDescriptor({
          authoring: { modelAttributes: { audit: makeModelAttributeDescriptor('audit') } },
        }),
        createDescriptor({
          id: 'other',
          authoring: { modelAttributes: { audit: makeModelAttributeDescriptor('audit') } },
        }),
      ]),
    ).toThrow(/Duplicate authoring modelAttribute helper "audit"/);
  });

  it('rejects two modelAttributes contributions at different paths claiming the same attribute name', () => {
    expect(() =>
      assembleAuthoringContributions([
        createDescriptor({
          authoring: { modelAttributes: { auditMarker: makeModelAttributeDescriptor('audit') } },
        }),
        createDescriptor({
          id: 'other',
          authoring: { modelAttributes: { anotherAudit: makeModelAttributeDescriptor('audit') } },
        }),
      ]),
    ).toThrow(
      /Duplicate modelAttribute "audit" registered at both "auditMarker" and "anotherAudit"/,
    );
  });

  it('rejects a malformed modelAttributes entry missing `lower`', () => {
    expect(() =>
      assembleAuthoringContributions([
        createDescriptor({
          authoring: {
            modelAttributes: {
              // Carries kind + attribute but missing required `lower`.
              audit: { kind: 'modelAttribute', attribute: 'audit', spec: {} } as unknown as never,
            },
          },
        }),
      ]),
    ).toThrow(/Malformed authoring modelAttribute contribution at "audit"/);
  });
});
