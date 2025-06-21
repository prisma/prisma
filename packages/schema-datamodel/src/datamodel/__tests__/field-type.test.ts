import { expect, test } from 'vitest'

import { FieldType } from '../field-type'

test('creates required field type', () => {
  const fieldType = FieldType.required('String')
  expect(fieldType.toString()).toBe('String')
  expect(fieldType.isRequired()).toBe(true)
  expect(fieldType.isOptional()).toBe(false)
  expect(fieldType.isArray()).toBe(false)
  expect(fieldType.isUnsupported()).toBe(false)
})

test('converts required to optional', () => {
  const fieldType = FieldType.required('Int')
  fieldType.intoOptional()
  expect(fieldType.toString()).toBe('Int?')
  expect(fieldType.isOptional()).toBe(true)
  expect(fieldType.isRequired()).toBe(false)
})

test('converts required to array', () => {
  const fieldType = FieldType.required('String')
  fieldType.intoArray()
  expect(fieldType.toString()).toBe('String[]')
  expect(fieldType.isArray()).toBe(true)
  expect(fieldType.isRequired()).toBe(false)
})

test('converts required to unsupported', () => {
  const fieldType = FieldType.required('CustomType')
  fieldType.intoUnsupported()
  expect(fieldType.toString()).toBe('Unsupported("CustomType")')
  expect(fieldType.isUnsupported()).toBe(true)
})

test('handles complex type transformations', () => {
  const fieldType = FieldType.required('String')
  fieldType.intoOptional()
  fieldType.intoArray()
  expect(fieldType.toString()).toBe('String[]')
  expect(fieldType.isArray()).toBe(true)
  expect(fieldType.isOptional()).toBe(false) // Array overrides optional
})

test('handles unsupported optional types', () => {
  const fieldType = FieldType.required('Custom')
  fieldType.intoOptional()
  fieldType.intoUnsupported()
  expect(fieldType.toString()).toBe('Unsupported("Custom")?')
  expect(fieldType.isUnsupported()).toBe(true)
  expect(fieldType.isOptional()).toBe(true)
})

test('handles unsupported array types', () => {
  const fieldType = FieldType.required('Custom')
  fieldType.intoArray()
  fieldType.intoUnsupported()
  expect(fieldType.toString()).toBe('Unsupported("Custom")[]')
  expect(fieldType.isUnsupported()).toBe(true)
  expect(fieldType.isArray()).toBe(true)
})
