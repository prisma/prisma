import { assertEquals, assertExists } from '@std/assert'
import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { delay } from '@std/async/delay'

import { TracingHandler } from './handler.ts'
import { TracingCollector, tracingCollectorContext } from './collector.ts'
import { getTestTracer } from './test_utils.ts'

// Set up async context for tests
context.setGlobalContextManager(new AsyncLocalStorageContextManager())

Deno.test('TracingHandler - runInChildSpan with string name', () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  const result = tracingCollectorContext.withActive(collector, () => {
    return handler.runInChildSpan('test-operation', (span, ctx) => {
      assertExists(span)
      assertExists(ctx)

      // Return a test value to verify that it's passed through
      return 'test-result'
    })
  })

  // Verify the result
  assertEquals(result, 'test-result')

  // Verify a span was collected
  assertEquals(collector.spans.length, 1)
  assertEquals(collector.spans[0].name, 'prisma:engine:test-operation')
})

Deno.test('TracingHandler - runInChildSpan with options object', () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  const result = tracingCollectorContext.withActive(collector, () => {
    return handler.runInChildSpan(
      {
        name: 'test-operation',
        attributes: { 'test.key': 'test.value' },
      },
      (span) => {
        // Set additional attributes on the span
        span?.setAttribute('another.key', 'another.value')

        return 'test-result'
      },
    )
  })

  // Verify the result
  assertEquals(result, 'test-result')

  // Verify a span was collected with the expected attributes
  assertEquals(collector.spans.length, 1)
  const collectedSpan = collector.spans[0]
  assertEquals(collectedSpan.name, 'prisma:engine:test-operation')
  assertExists(collectedSpan.attributes)
  assertEquals(collectedSpan.attributes!['test.key'], 'test.value')
  assertEquals(collectedSpan.attributes!['another.key'], 'another.value')
})

Deno.test('TracingHandler - runInChildSpan with async function', async () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  const result = await tracingCollectorContext.withActive(collector, () => {
    return handler.runInChildSpan('async-operation', async (_span) => {
      await delay(10) // Simulate async work
      return 'async-result'
    })
  })

  // Verify the result
  assertEquals(result, 'async-result')

  // Verify a span was collected
  assertEquals(collector.spans.length, 1)
  assertEquals(collector.spans[0].name, 'prisma:engine:async-operation')
})

Deno.test('TracingHandler - runs without active collector', () => {
  const handler = new TracingHandler(getTestTracer())

  // This should not throw, even though there's no collector
  const result = handler.runInChildSpan('test-operation', (_span) => {
    return 'test-result'
  })

  // Verify the function executed normally
  assertEquals(result, 'test-result')
})

Deno.test('TracingHandler - handles errors in sync functions', () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  let error: Error | undefined
  try {
    tracingCollectorContext.withActive(collector, () => {
      handler.runInChildSpan('error-operation', () => {
        throw new Error('Test error')
      })
    })
  } catch (e) {
    error = e as Error
  }

  // Verify the error was propagated
  assertExists(error)
  assertEquals(error.message, 'Test error')

  // Verify a span was collected despite the error
  assertEquals(collector.spans.length, 1)
  assertEquals(collector.spans[0].name, 'prisma:engine:error-operation')
})

Deno.test('TracingHandler - handles errors in async functions', async () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  let error: Error | undefined
  try {
    await tracingCollectorContext.withActive(collector, () => {
      return handler.runInChildSpan('async-error-operation', async () => {
        await delay(10) // Simulate async work
        throw new Error('Async test error')
      })
    })
  } catch (e) {
    error = e as Error
  }

  // Verify the error was propagated
  assertExists(error)
  assertEquals(error.message, 'Async test error')

  // Verify a span was collected despite the error
  assertEquals(collector.spans.length, 1)
  assertEquals(collector.spans[0].name, 'prisma:engine:async-error-operation')
})

Deno.test('TracingHandler - nested spans create parent-child relationship', () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  tracingCollectorContext.withActive(collector, () => {
    handler.runInChildSpan('parent-operation', (_parentSpan) => {
      // Run a child span inside the parent span
      handler.runInChildSpan('child-operation', (_childSpan) => {
        // Do some work in the child span
      })
    })
  })

  // Verify both spans were collected
  assertEquals(collector.spans.length, 2)

  // Sort spans to ensure we have parent first, child second
  const spans = [...collector.spans].sort((a, b) => a.name.localeCompare(b.name))

  // Extract the span IDs
  // child-operation comes first alphabetically, parent-operation second
  const parentId = spans[1].id

  // Verify the child has the parent ID
  assertEquals(spans[0].parentId, parentId)
  assertEquals(spans[0].name, 'prisma:engine:child-operation')
  assertEquals(spans[1].name, 'prisma:engine:parent-operation')
})

Deno.test('TracingHandler - root option creates spans without parent', () => {
  const collector = TracingCollector.newInCurrentContext()
  const handler = new TracingHandler(getTestTracer())

  tracingCollectorContext.withActive(collector, () => {
    // Create a normal span first
    handler.runInChildSpan('parent-operation', (_parentSpan) => {
      // Then create a root span that ignores the parent
      handler.runInChildSpan(
        {
          name: 'root-operation',
          root: true, // This makes it ignore any active parent span
        },
        (_rootSpan) => {
          // Do some work in the root span
        },
      )
    })
  })

  // Verify both spans were collected
  assertEquals(collector.spans.length, 2)

  // Find the root span
  const rootSpan = collector.spans.find((span) => span.name === 'prisma:engine:root-operation')

  // Verify it has no parent
  assertExists(rootSpan)
  assertEquals(rootSpan.parentId, null)
})

Deno.test('TracingHandler - outer spans internal to the server are sanitized', () => {
  const handler = new TracingHandler(getTestTracer())

  handler.runInChildSpan('internal-operation', () => {
    const collector = TracingCollector.newInCurrentContext()

    tracingCollectorContext.withActive(collector, () => {
      handler.runInChildSpan('root-operation', () => {})
    })

    assertEquals(collector.spans.length, 1)

    const rootSpan = collector.spans.find((span) => span.name === 'prisma:engine:root-operation')

    assertExists(rootSpan)
    assertEquals(rootSpan.parentId, null)
  })
})
