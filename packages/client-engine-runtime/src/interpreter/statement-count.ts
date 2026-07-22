import { QueryPlanNode } from '../query-plan'
import { assertNever, DeepReadonly } from '../utils'

/**
 * Returns an upper bound on the number of statement nodes (`query` or `execute`) that can be
 * evaluated when interpreting the given query plan subtree.
 *
 * Note that a single statement node may still be rendered into multiple SQL statements at
 * runtime if its parameters need to be split into chunks, so callers that rely on this bound
 * for atomicity decisions must account for chunking separately.
 *
 * Nested `transaction` nodes are treated as unbounded because they manage their own lifecycle.
 */
export function getMaxStatementNodeCount(node: DeepReadonly<QueryPlanNode>): number {
  switch (node.type) {
    case 'value':
    case 'get':
    case 'getFirstNonEmpty':
    case 'unit':
      return 0

    case 'query':
    case 'execute':
      return 1

    case 'seq':
    case 'concat':
    case 'sum':
      return node.args.reduce((acc, arg) => acc + getMaxStatementNodeCount(arg), 0)

    case 'let':
      return (
        node.args.bindings.reduce((acc, binding) => acc + getMaxStatementNodeCount(binding.expr), 0) +
        getMaxStatementNodeCount(node.args.expr)
      )

    case 'reverse':
    case 'unique':
    case 'required':
      return getMaxStatementNodeCount(node.args)

    case 'mapField':
      return getMaxStatementNodeCount(node.args.records)

    case 'dataMap':
    case 'validate':
    case 'process':
    case 'initializeRecord':
    case 'mapRecord':
      return getMaxStatementNodeCount(node.args.expr)

    case 'join':
      return (
        getMaxStatementNodeCount(node.args.parent) +
        node.args.children.reduce((acc, child) => acc + getMaxStatementNodeCount(child.child), 0)
      )

    // Only one of the branches is evaluated, so the bound is the larger of the two.
    case 'if':
      return (
        getMaxStatementNodeCount(node.args.value) +
        Math.max(getMaxStatementNodeCount(node.args.then), getMaxStatementNodeCount(node.args.else))
      )

    case 'diff':
      return getMaxStatementNodeCount(node.args.from) + getMaxStatementNodeCount(node.args.to)

    case 'transaction':
      return Infinity

    default:
      assertNever(node, `Unexpected node type: ${(node as { type: unknown }).type}`)
  }
}
