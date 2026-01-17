import type { RuntimeDataModel } from '@prisma/client-common'
import type { ParamGraph } from '@prisma/param-graph'
import { EdgeFlag, ScalarMask } from '@prisma/param-graph'

import { createParamGraphView } from './paramGraphView'

describe('createParamGraphView', () => {
  // Sample ParamGraph for testing
  const sampleGraph: ParamGraph = {
    s: ['id', 'email', 'name', 'where', 'equals', 'posts', 'title', 'status'],
    en: ['Status', 'Role'],
    i: [
      // Node 0: UserWhereInput
      {
        f: {
          0: { k: EdgeFlag.ParamScalar | EdgeFlag.Object, m: ScalarMask.String, c: 1 }, // id
          1: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // email
          2: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // name
          7: { k: EdgeFlag.ParamScalar, m: ScalarMask.String, e: 0 }, // status (with enum)
        },
      },
      // Node 1: StringFilter
      {
        f: {
          4: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // equals
        },
      },
      // Node 2: FindManyUserArgs
      {
        f: {
          3: { k: EdgeFlag.Object, c: 0 }, // where
        },
      },
    ],
    o: [
      // Node 0: UserOutput
      {
        f: {
          5: { a: 3, o: 1 }, // posts: args -> PostFindManyArgs, output -> PostOutput
        },
      },
      // Node 1: PostOutput
      {
        f: {
          6: { a: undefined, o: undefined }, // title: no args, no nested output
        },
      },
    ],
    r: {
      'User.findMany': { a: 2, o: 0 },
      'User.findUnique': { a: 2, o: 0 },
      executeRaw: { a: undefined, o: undefined },
    },
  }

  const sampleRuntimeDataModel: RuntimeDataModel = {
    models: {},
    enums: {
      Status: {
        values: [
          { name: 'ACTIVE', dbName: null },
          { name: 'INACTIVE', dbName: null },
        ],
        dbName: null,
      },
      Role: {
        values: [
          { name: 'ADMIN', dbName: null },
          { name: 'USER', dbName: null },
        ],
        dbName: null,
      },
    },
    types: {},
  }

  describe('root', () => {
    it('returns root entry for model.action key', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const root = view.root('User.findMany')
      expect(root).toEqual({ a: 2, o: 0 })
    })

    it('returns root entry for action-only key', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const root = view.root('executeRaw')
      expect(root).toEqual({ a: undefined, o: undefined })
    })

    it('returns undefined for unknown root key', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const root = view.root('Unknown.action')
      expect(root).toBeUndefined()
    })
  })

  describe('inputNode', () => {
    it('returns input node by id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      expect(node).toBeDefined()
      expect(node?.f).toBeDefined()
      expect(Object.keys(node?.f ?? {}).length).toBe(4)
    })

    it('returns undefined for undefined id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(undefined)
      expect(node).toBeUndefined()
    })

    it('returns undefined for out-of-bounds id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(999)
      expect(node).toBeUndefined()
    })
  })

  describe('outputNode', () => {
    it('returns output node by id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.outputNode(0)
      expect(node).toBeDefined()
      expect(node?.f).toBeDefined()
    })

    it('returns undefined for undefined id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.outputNode(undefined)
      expect(node).toBeUndefined()
    })

    it('returns undefined for out-of-bounds id', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.outputNode(999)
      expect(node).toBeUndefined()
    })
  })

  describe('inputEdge', () => {
    it('returns input edge for known field', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'id')
      expect(edge).toBeDefined()
      expect(edge?.k).toBe(EdgeFlag.ParamScalar | EdgeFlag.Object)
      expect(edge?.m).toBe(ScalarMask.String)
      expect(edge?.c).toBe(1)
    })

    it('returns input edge for field without child', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'email')
      expect(edge).toBeDefined()
      expect(edge?.k).toBe(EdgeFlag.ParamScalar)
      expect(edge?.m).toBe(ScalarMask.String)
      expect(edge?.c).toBeUndefined()
    })

    it('returns input edge with enum reference', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'status')
      expect(edge).toBeDefined()
      expect(edge?.e).toBe(0)
    })

    it('returns undefined for unknown field', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'unknownField')
      expect(edge).toBeUndefined()
    })

    it('returns undefined for undefined node', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const edge = view.inputEdge(undefined, 'id')
      expect(edge).toBeUndefined()
    })

    it('returns undefined for node without fields', () => {
      const graphWithEmptyNode: ParamGraph = {
        ...sampleGraph,
        i: [...sampleGraph.i, {}],
      }
      const view = createParamGraphView(graphWithEmptyNode, sampleRuntimeDataModel)
      const node = view.inputNode(3)
      const edge = view.inputEdge(node, 'id')
      expect(edge).toBeUndefined()
    })
  })

  describe('outputEdge', () => {
    it('returns output edge for known field', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.outputNode(0)
      const edge = view.outputEdge(node, 'posts')
      expect(edge).toBeDefined()
      expect(edge?.a).toBe(3)
      expect(edge?.o).toBe(1)
    })

    it('returns undefined for unknown field', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.outputNode(0)
      const edge = view.outputEdge(node, 'unknownField')
      expect(edge).toBeUndefined()
    })

    it('returns undefined for undefined node', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const edge = view.outputEdge(undefined, 'posts')
      expect(edge).toBeUndefined()
    })

    it('returns undefined for node without fields', () => {
      const graphWithEmptyNode: ParamGraph = {
        ...sampleGraph,
        o: [...sampleGraph.o, {}],
      }
      const view = createParamGraphView(graphWithEmptyNode, sampleRuntimeDataModel)
      const node = view.outputNode(2)
      const edge = view.outputEdge(node, 'posts')
      expect(edge).toBeUndefined()
    })
  })

  describe('enumValues', () => {
    it('returns enum values for edge with enum reference', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'status')
      const values = view.enumValues(edge)
      expect(values).toEqual(['ACTIVE', 'INACTIVE'])
    })

    it('returns undefined for edge without enum reference', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'email')
      const values = view.enumValues(edge)
      expect(values).toBeUndefined()
    })

    it('returns undefined for undefined edge', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const values = view.enumValues(undefined)
      expect(values).toBeUndefined()
    })

    it('returns undefined for enum not in runtimeDataModel', () => {
      const runtimeModelWithoutEnum: RuntimeDataModel = {
        models: {},
        enums: {},
        types: {},
      }
      const view = createParamGraphView(sampleGraph, runtimeModelWithoutEnum)
      const node = view.inputNode(0)
      const edge = view.inputEdge(node, 'status')
      const values = view.enumValues(edge)
      expect(values).toBeUndefined()
    })

    it('returns values for second enum', () => {
      const graphWithSecondEnum: ParamGraph = {
        ...sampleGraph,
        i: [
          ...sampleGraph.i,
          {
            f: {
              0: { k: EdgeFlag.ParamScalar, m: ScalarMask.String, e: 1 }, // role with enum index 1
            },
          },
        ],
      }
      const view = createParamGraphView(graphWithSecondEnum, sampleRuntimeDataModel)
      const node = view.inputNode(3)
      const edge = view.inputEdge(node, 'id')
      const values = view.enumValues(edge)
      expect(values).toEqual(['ADMIN', 'USER'])
    })
  })

  describe('string index lookup', () => {
    it('correctly maps field names to string indices', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)

      // Test each field in the sample graph
      expect(view.inputEdge(node, 'id')).toBeDefined()
      expect(view.inputEdge(node, 'email')).toBeDefined()
      expect(view.inputEdge(node, 'name')).toBeDefined()
      expect(view.inputEdge(node, 'status')).toBeDefined()
    })

    it('handles case-sensitive field names', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)
      const node = view.inputNode(0)

      expect(view.inputEdge(node, 'id')).toBeDefined()
      expect(view.inputEdge(node, 'ID')).toBeUndefined()
      expect(view.inputEdge(node, 'Id')).toBeUndefined()
    })
  })

  describe('full traversal flow', () => {
    it('can traverse from root to nested input nodes', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)

      // Get root
      const root = view.root('User.findMany')
      expect(root).toBeDefined()

      // Get args node
      const argsNode = view.inputNode(root?.a)
      expect(argsNode).toBeDefined()

      // Get where edge
      const whereEdge = view.inputEdge(argsNode, 'where')
      expect(whereEdge).toBeDefined()
      expect(whereEdge?.k).toBe(EdgeFlag.Object)

      // Get where input node
      const whereNode = view.inputNode(whereEdge?.c)
      expect(whereNode).toBeDefined()

      // Get id edge in where
      const idEdge = view.inputEdge(whereNode, 'id')
      expect(idEdge).toBeDefined()
      expect(idEdge?.k).toBe(EdgeFlag.ParamScalar | EdgeFlag.Object)
    })

    it('can traverse from root to nested output nodes', () => {
      const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)

      // Get root
      const root = view.root('User.findMany')
      expect(root).toBeDefined()

      // Get output node
      const outNode = view.outputNode(root?.o)
      expect(outNode).toBeDefined()

      // Get posts edge
      const postsEdge = view.outputEdge(outNode, 'posts')
      expect(postsEdge).toBeDefined()
      expect(postsEdge?.a).toBe(3)
      expect(postsEdge?.o).toBe(1)

      // Get nested output node
      const nestedOutNode = view.outputNode(postsEdge?.o)
      expect(nestedOutNode).toBeDefined()
    })
  })
})
