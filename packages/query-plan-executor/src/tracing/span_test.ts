import { assertEquals, assertExists, assertStrictEquals } from '@std/assert'
import { context, SpanKind, SpanStatusCode, trace as _trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'

import { SpanProxy } from './span.ts'
import { getTestTracer } from './test_utils.ts'
import { ExtendedSpanOptions } from './options.ts'

// Set up async context for tests
context.setGlobalContextManager(new AsyncLocalStorageContextManager())

const TEST_NAME = 'test-span'
const TEST_ATTRIBUTES = { 'test.key': 'test.value' }

Deno.test('SpanProxy - constructor stores span details', () => {
  const tracer = getTestTracer()

  const originalSpan = tracer.startSpan(TEST_NAME)
  const now = Temporal.Now.instant()

  const spanOptions: ExtendedSpanOptions = {
    name: TEST_NAME,
    kind: SpanKind.SERVER,
    attributes: TEST_ATTRIBUTES,
  }

  const proxy = new SpanProxy({
    span: originalSpan,
    parentSpan: undefined,
    spanOptions,
    trueStartTime: now,
  })

  assertExists(proxy)
  assertEquals(proxy.isRecording(), true)
})

Deno.test('SpanProxy - passes through Span API methods', () => {
  const tracer = getTestTracer()

  const originalSpan = tracer.startSpan(TEST_NAME)
  const now = Temporal.Now.instant()

  const spanOptions: ExtendedSpanOptions = {
    name: TEST_NAME,
    kind: SpanKind.SERVER,
  }

  const proxy = new SpanProxy({
    span: originalSpan,
    parentSpan: undefined,
    spanOptions,
    trueStartTime: now,
  })

  // Test attribute setting
  proxy.setAttribute('key1', 'value1')
  proxy.setAttributes({
    key2: 'value2',
    key3: 123,
  })

  // Test status setting
  proxy.setStatus({ code: SpanStatusCode.ERROR, message: 'Test error' })

  // Test name update
  proxy.updateName('updated-name')

  // End the span
  proxy.end()

  assertEquals(proxy.isRecording(), false, 'Span should not be recording after end')
})

Deno.test('SpanProxy - endAndExport creates correctly formatted span', () => {
  const tracer = getTestTracer()

  // Create a parent span first
  const parentSpan = tracer.startSpan('parent-span')

  // Then create the span we'll test
  const originalSpan = tracer.startSpan(TEST_NAME)
  const startTime = Temporal.Instant.from('2023-01-01T00:00:00Z')
  const endTime = Temporal.Instant.from('2023-01-01T00:00:01Z')

  const spanOptions: ExtendedSpanOptions = {
    name: TEST_NAME,
    kind: SpanKind.CLIENT,
    attributes: TEST_ATTRIBUTES,
  }

  const proxy = new SpanProxy({
    span: originalSpan,
    parentSpan,
    spanOptions,
    trueStartTime: startTime,
  })

  // Add event and link
  proxy.addEvent('test-event')
  proxy.addLink({
    context: parentSpan.spanContext(),
  })

  // Export the span
  const exported = proxy.endAndExport(endTime)

  // Verify the exported span
  assertEquals(exported.name, `prisma:engine:${TEST_NAME}`)
  assertEquals(exported.kind, 'client')
  assertExists(exported.id)
  assertExists(exported.parentId)
  assertExists(exported.attributes)
  assertExists(exported.links)
  assertEquals(exported.attributes!['test.key'], 'test.value')
  assertEquals(exported.links!.length, 1)

  // Ensure span is ended
  assertEquals(proxy.isRecording(), false)
})

Deno.test('SpanProxy - endAndExport works with optional fields omitted', () => {
  const tracer = getTestTracer()

  const originalSpan = tracer.startSpan(TEST_NAME)
  const now = Temporal.Now.instant()

  const spanOptions: ExtendedSpanOptions = {
    name: TEST_NAME,
  }

  const proxy = new SpanProxy({
    span: originalSpan,
    parentSpan: undefined,
    spanOptions,
    trueStartTime: now,
  })

  // Export the span with minimal options
  const exported = proxy.endAndExport(now)

  // Verify the exported span
  assertEquals(exported.name, `prisma:engine:${TEST_NAME}`)
  assertEquals(exported.kind, 'internal') // Default value
  assertExists(exported.id)
  assertEquals(exported.parentId, null)
  assertEquals(exported.attributes, undefined)
  assertEquals(exported.links, undefined)
})

Deno.test('SpanProxy - respects provided start time', () => {
  const tracer = getTestTracer()

  const originalSpan = tracer.startSpan(TEST_NAME)
  const trueStartTime = Temporal.Instant.from('2023-01-01T00:00:00Z')
  const providedStartTime = [1672531100, 0] as [number, number] // Define it as a tuple with two elements
  const endTime = Temporal.Instant.from('2023-01-01T00:10:00Z')

  const spanOptions: ExtendedSpanOptions = {
    name: TEST_NAME,
    startTime: providedStartTime,
  }

  const proxy = new SpanProxy({
    span: originalSpan,
    parentSpan: undefined,
    spanOptions,
    trueStartTime,
  })

  // Export the span
  const exported = proxy.endAndExport(endTime)

  // Verify the start time is the provided one, not the true start time
  assertStrictEquals(exported.startTime[0], providedStartTime[0])
  assertStrictEquals(exported.startTime[1], providedStartTime[1])
})
