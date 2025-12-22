/**
 * Detailed Interpreter Performance Profiling
 *
 * Measures individual components of the interpreter to identify optimization opportunities.
 */
import { QueryInterpreter } from '../src/interpreter/query-interpreter'
import { serializeSql } from '../src/interpreter/serialize-sql'
import { applyDataMap } from '../src/interpreter/data-mapper'
import { renderQuery } from '../src/interpreter/render-query'
import { withQuerySpanAndEvent, noopTracingHelper } from '../src/tracing'
import { createConfiguredMockAdapter, createInterpreterOptions } from './bench-utils'
import { FIND_UNIQUE_PLAN, SIMPLE_SELECT_PLAN, JOIN_PLAN } from './sample-query-plans'

function measure<T>(name: string, fn: () => T, iterations = 10000): { result: T; avgUs: number; opsPerSec: number } {
  // Warmup
  for (let i = 0; i < 100; i++) fn()

  const start = process.hrtime.bigint()
  let result: T
  for (let i = 0; i < iterations; i++) {
    result = fn()
  }
  const elapsed = Number(process.hrtime.bigint() - start)
  const avgNs = elapsed / iterations
  const avgUs = avgNs / 1000

  return { result: result!, avgUs, opsPerSec: 1_000_000_000 / avgNs }
}

async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  iterations = 10000,
): Promise<{ result: T; avgUs: number; opsPerSec: number }> {
  // Warmup
  for (let i = 0; i < 100; i++) await fn()

  const start = process.hrtime.bigint()
  let result: T
  for (let i = 0; i < iterations; i++) {
    result = await fn()
  }
  const elapsed = Number(process.hrtime.bigint() - start)
  const avgNs = elapsed / iterations
  const avgUs = avgNs / 1000

  return { result: result!, avgUs, opsPerSec: 1_000_000_000 / avgNs }
}

async function runProfiling() {
  console.log('Setting up interpreter profiling environment...\n')

  const mockAdapter = createConfiguredMockAdapter()
  const interpreterOptions = createInterpreterOptions()

  console.log('╔════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                    Interpreter Component Profile Results                       ║')
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
  console.log('║ Component                          │ Avg (μs) │     Ops/sec │ Notes            ║')
  console.log('╠════════════════════════════════════╪══════════╪═════════════╪══════════════════╣')

  // 1. QueryInterpreter construction
  const construct = measure('QueryInterpreter.forSql', () => {
    return QueryInterpreter.forSql(interpreterOptions)
  })
  console.log(`║ QueryInterpreter.forSql            │ ${construct.avgUs.toFixed(2).padStart(8)} │ ${Math.round(construct.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 2. Promise.resolve overhead (baseline)
  const promiseResolve = measure('Promise.resolve', () => {
    return Promise.resolve(42)
  })
  console.log(`║ Promise.resolve (baseline)         │ ${promiseResolve.avgUs.toFixed(2).padStart(8)} │ ${Math.round(promiseResolve.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 3. await Promise.resolve (async overhead)
  const awaitPromise = await measureAsync('await Promise.resolve', async () => {
    return await Promise.resolve(42)
  })
  console.log(`║ await Promise.resolve              │ ${awaitPromise.avgUs.toFixed(2).padStart(8)} │ ${Math.round(awaitPromise.opsPerSec).toLocaleString().padStart(11)} │ async overhead   ║`)

  // 4. Data serialization
  const mockResultSet = {
    columnNames: ['id', 'email', 'name'],
    columnTypes: [0, 1, 1],
    rows: [[1, 'user@example.com', 'User']],
  }
  const serialize = measure('serializeSql', () => {
    return serializeSql(mockResultSet)
  })
  console.log(`║ serializeSql (1 row)               │ ${serialize.avgUs.toFixed(2).padStart(8)} │ ${Math.round(serialize.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 5. Data mapping
  const serialized = serializeSql(mockResultSet)
  const simpleStructure = SIMPLE_SELECT_PLAN.args.structure
  const dataMap = measure('applyDataMap (1 row)', () => {
    return applyDataMap(serialized, simpleStructure, {})
  })
  console.log(`║ applyDataMap (1 row)               │ ${dataMap.avgUs.toFixed(2).padStart(8)} │ ${Math.round(dataMap.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 6. Query rendering
  if (SIMPLE_SELECT_PLAN.args.expr.type === 'query') {
    const queryArgs = SIMPLE_SELECT_PLAN.args.expr.args
    const render = measure('renderQuery', () => {
      return renderQuery(queryArgs, {}, { getNextGeneratedValue: () => 1 }, undefined)
    })
    console.log(`║ renderQuery (simple)               │ ${render.avgUs.toFixed(2).padStart(8)} │ ${Math.round(render.opsPerSec).toLocaleString().padStart(11)} │                  ║`)
  }

  // 7. Object creation overhead
  const wrapValue = measure('object creation', () => {
    return { value: 42, lastInsertId: undefined }
  })
  console.log(`║ Object { value, lastInsertId }     │ ${wrapValue.avgUs.toFixed(2).padStart(8)} │ ${Math.round(wrapValue.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 8. Object.create overhead (for scopes)
  const scope = { a: 1, b: 2 }
  const objCreate = measure('Object.create(scope)', () => {
    return Object.create(scope)
  })
  console.log(`║ Object.create (scope inheritance)  │ ${objCreate.avgUs.toFixed(2).padStart(8)} │ ${Math.round(objCreate.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 9. new Date() overhead
  const newDate = measure('new Date()', () => {
    return new Date()
  })
  console.log(`║ new Date()                         │ ${newDate.avgUs.toFixed(2).padStart(8)} │ ${Math.round(newDate.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 10. performance.now() overhead
  const perfNow = measure('performance.now()', () => {
    return performance.now()
  })
  console.log(`║ performance.now()                  │ ${perfNow.avgUs.toFixed(2).padStart(8)} │ ${Math.round(perfNow.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 11. withQuerySpanAndEvent overhead (noop tracing, no onQuery)
  const mockQuery = { sql: 'SELECT 1', args: [] }
  const spanNoOnQuery = await measureAsync('withQuerySpanAndEvent (no onQuery)', async () => {
    return withQuerySpanAndEvent({
      query: mockQuery,
      tracingHelper: noopTracingHelper,
      provider: 'sqlite' as any,
      execute: () => Promise.resolve(42),
    })
  })
  console.log(`║ withQuerySpanAndEvent (no onQuery) │ ${spanNoOnQuery.avgUs.toFixed(2).padStart(8)} │ ${Math.round(spanNoOnQuery.opsPerSec).toLocaleString().padStart(11)} │ fast path        ║`)

  // 11b. withQuerySpanAndEvent with onQuery callback
  const spanWithOnQuery = await measureAsync('withQuerySpanAndEvent (with onQuery)', async () => {
    return withQuerySpanAndEvent({
      query: mockQuery,
      tracingHelper: noopTracingHelper,
      provider: 'sqlite' as any,
      onQuery: () => {},
      execute: () => Promise.resolve(42),
    })
  })
  console.log(`║ withQuerySpanAndEvent (onQuery)    │ ${spanWithOnQuery.avgUs.toFixed(2).padStart(8)} │ ${Math.round(spanWithOnQuery.opsPerSec).toLocaleString().padStart(11)} │ full path        ║`)

  // 12. MockAdapter.queryRaw overhead
  const queryRaw = await measureAsync('mockAdapter.queryRaw', async () => {
    return mockAdapter.queryRaw({ sql: 'SELECT id, email, name FROM User LIMIT 10', args: [] })
  })
  console.log(`║ mockAdapter.queryRaw               │ ${queryRaw.avgUs.toFixed(2).padStart(8)} │ ${Math.round(queryRaw.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // 13. Full query path (renderQuery + withSpan + mockAdapter + serialize)
  const fullQueryPath = await measureAsync('full query path', async () => {
    const queries = renderQuery(
      (SIMPLE_SELECT_PLAN.args.expr as any).args,
      {},
      { getNextGeneratedValue: () => 1 },
      undefined,
    )
    let result
    for (const query of queries) {
      result = await withQuerySpanAndEvent({
        query,
        tracingHelper: noopTracingHelper,
        provider: 'sqlite' as any,
        execute: () => mockAdapter.queryRaw(query),
      })
    }
    return serializeSql(result!)
  })
  console.log(`║ Full query path (render→exec→ser)  │ ${fullQueryPath.avgUs.toFixed(2).padStart(8)} │ ${Math.round(fullQueryPath.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  console.log('╠════════════════════════════════════╪══════════╪═════════════╪══════════════════╣')

  // Full interpreter runs
  const simpleSelect = await measureAsync('interpreter simple select', async () => {
    const interpreter = QueryInterpreter.forSql(interpreterOptions)
    return interpreter.run(SIMPLE_SELECT_PLAN, mockAdapter)
  })
  console.log(`║ FULL: Simple select (2 nodes)      │ ${simpleSelect.avgUs.toFixed(2).padStart(8)} │ ${Math.round(simpleSelect.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  const findUnique = await measureAsync('interpreter findUnique', async () => {
    const interpreter = QueryInterpreter.forSql(interpreterOptions)
    return interpreter.run(FIND_UNIQUE_PLAN, mockAdapter)
  })
  console.log(`║ FULL: findUnique (3 nodes)         │ ${findUnique.avgUs.toFixed(2).padStart(8)} │ ${Math.round(findUnique.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  const joinQuery = await measureAsync('interpreter join', async () => {
    const interpreter = QueryInterpreter.forSql(interpreterOptions)
    return interpreter.run(JOIN_PLAN, mockAdapter)
  })
  console.log(`║ FULL: Join (4 nodes, 2 queries)    │ ${joinQuery.avgUs.toFixed(2).padStart(8)} │ ${Math.round(joinQuery.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // Reusing interpreter (no construction overhead)
  const interpreter = QueryInterpreter.forSql(interpreterOptions)
  const simpleSelectReuse = await measureAsync('interpreter simple (reuse)', async () => {
    return interpreter.run(SIMPLE_SELECT_PLAN, mockAdapter)
  })
  console.log(`║ REUSE: Simple select               │ ${simpleSelectReuse.avgUs.toFixed(2).padStart(8)} │ ${Math.round(simpleSelectReuse.opsPerSec).toLocaleString().padStart(11)} │ no construct     ║`)

  const findUniqueReuse = await measureAsync('interpreter findUnique (reuse)', async () => {
    return interpreter.run(FIND_UNIQUE_PLAN, mockAdapter)
  })
  console.log(`║ REUSE: findUnique                  │ ${findUniqueReuse.avgUs.toFixed(2).padStart(8)} │ ${Math.round(findUniqueReuse.opsPerSec).toLocaleString().padStart(11)} │ no construct     ║`)

  // Recursive async overhead simulation
  async function recursiveAsync(depth: number): Promise<number> {
    if (depth === 0) return 42
    return await recursiveAsync(depth - 1)
  }
  const recursive3 = await measureAsync('recursive async (3 deep)', async () => {
    return recursiveAsync(3)
  })
  console.log(`║ Recursive async (3 deep)           │ ${recursive3.avgUs.toFixed(2).padStart(8)} │ ${Math.round(recursive3.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  const recursive5 = await measureAsync('recursive async (5 deep)', async () => {
    return recursiveAsync(5)
  })
  console.log(`║ Recursive async (5 deep)           │ ${recursive5.avgUs.toFixed(2).padStart(8)} │ ${Math.round(recursive5.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // Measure catch overhead
  const withCatch = await measureAsync('Promise with .catch()', async () => {
    return Promise.resolve(42).catch((e) => { throw e })
  })
  console.log(`║ Promise with .catch()              │ ${withCatch.avgUs.toFixed(2).padStart(8)} │ ${Math.round(withCatch.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  console.log('╚════════════════════════════════════════════════════════════════════════════════╝')

  // Analysis
  console.log('\n═══════════════════════════════════════════════════════════════════════════════════')
  console.log('ANALYSIS:')
  console.log(`  Constructor overhead: ${construct.avgUs.toFixed(2)}μs (${((construct.avgUs / simpleSelect.avgUs) * 100).toFixed(1)}% of simple select)`)
  console.log(`  Async overhead (per await): ${awaitPromise.avgUs.toFixed(2)}μs`)
  console.log(`  Serialization: ${serialize.avgUs.toFixed(2)}μs`)
  console.log(`  Data mapping: ${dataMap.avgUs.toFixed(2)}μs`)
  console.log(`  Object creation: ${wrapValue.avgUs.toFixed(5)}μs`)
  console.log('')
  console.log('  Estimated time breakdown for findUnique (3 nodes):')
  console.log(`    - Constructor: ${construct.avgUs.toFixed(2)}μs`)
  console.log(`    - 3x async overhead: ${(awaitPromise.avgUs * 3).toFixed(2)}μs`)
  console.log(`    - Serialization: ${serialize.avgUs.toFixed(2)}μs`)
  console.log(`    - Data mapping: ${dataMap.avgUs.toFixed(2)}μs`)
  console.log(`    - Total estimate: ${(construct.avgUs + awaitPromise.avgUs * 3 + serialize.avgUs + dataMap.avgUs).toFixed(2)}μs`)
  console.log(`    - Actual: ${findUnique.avgUs.toFixed(2)}μs`)
  console.log('')
  console.log('  Reusing interpreter eliminates constructor overhead:')
  console.log(`    - Simple select: ${simpleSelect.avgUs.toFixed(2)}μs → ${simpleSelectReuse.avgUs.toFixed(2)}μs (${((1 - simpleSelectReuse.avgUs / simpleSelect.avgUs) * 100).toFixed(1)}% faster)`)
  console.log(`    - findUnique: ${findUnique.avgUs.toFixed(2)}μs → ${findUniqueReuse.avgUs.toFixed(2)}μs (${((1 - findUniqueReuse.avgUs / findUnique.avgUs) * 100).toFixed(1)}% faster)`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════')
}

runProfiling().catch(console.error)
