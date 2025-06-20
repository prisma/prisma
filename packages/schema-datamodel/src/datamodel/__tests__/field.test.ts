import { expect, test } from 'vitest'
import { Field, IdFieldDefinition, UniqueFieldAttribute, Relation } from '../field'
import { DefaultValue } from '../default-value'
import { Function } from '../../values'

test('creates basic required field', () => {
  const field = Field.create('name', 'String')
  expect(field.toString()).toBe('name String')
  expect(field.getName()).toBe('name')
})

test('creates optional field', () => {
  const field = Field.create('name', 'String')
  field.optional()
  expect(field.toString()).toBe('name String?')
})

test('creates array field', () => {
  const field = Field.create('tags', 'String')
  field.array()
  expect(field.toString()).toBe('tags String[]')
})

test('creates field with documentation', () => {
  const field = Field.create('name', 'String')
  field.documentation('The user name')
  expect(field.toString()).toBe('/// The user name\nname String')
})

test('creates field with map attribute', () => {
  const field = Field.create('name', 'String')
  field.map('full_name')
  expect(field.toString()).toBe('name String @map("full_name")')
})

test('creates field with default value', () => {
  const field = Field.create('createdAt', 'DateTime')
  const defaultValue = DefaultValue.function(Function.create('now'))
  field.default(defaultValue)
  expect(field.toString()).toBe('createdAt DateTime @default(now())')
})

test('creates field with text default', () => {
  const field = Field.create('status', 'String')
  field.default(DefaultValue.text('active'))
  expect(field.toString()).toBe('status String @default("active")')
})

test('creates field with constant default', () => {
  const field = Field.create('count', 'Int')
  field.default(DefaultValue.constant(0))
  expect(field.toString()).toBe('count Int @default(0)')
})

test('creates field with native type', () => {
  const field = Field.create('description', 'String')
  field.nativeType('db', 'VarChar', ['255'])
  expect(field.toString()).toBe('description String @db.VarChar("255")')
})

test('creates ID field', () => {
  const field = Field.create('id', 'Int')
  const idDef = IdFieldDefinition.create()
  field.idField(idDef)
  expect(field.toString()).toBe('id Int @id')
})

test('creates ID field with options', () => {
  const field = Field.create('id', 'String')
  const idDef = IdFieldDefinition.create()
    .sortOrder('Desc')
    .length(32)
    .clustered(false)
  field.idField(idDef)
  expect(field.toString()).toBe('id String @id(sort: Desc, length: 32, clustered: false)')
})

test('creates unique field', () => {
  const field = Field.create('email', 'String')
  const uniqueAttr = UniqueFieldAttribute.create()
  field.uniqueConstraint(uniqueAttr)
  expect(field.toString()).toBe('email String @unique')
})

test('creates unique field with options', () => {
  const field = Field.create('email', 'String')
  const uniqueAttr = UniqueFieldAttribute.create()
    .sortOrder('Asc')
    .length(100)
    .clustered(true)
  field.uniqueConstraint(uniqueAttr)
  expect(field.toString()).toBe('email String @unique(sort: Asc, length: 100, clustered: true)')
})

test('creates relation field', () => {
  const field = Field.create('user', 'User')
  const relation = Relation.create()
    .fields(['userId'])
    .references(['id'])
    .onDelete('Cascade')
    .onUpdate('Restrict')
  field.relationField(relation)
  expect(field.toString()).toBe('user User @relation(fields: [userId], references: [id], onDelete: "Cascade", onUpdate: "Restrict")')
})

test('creates updatedAt field', () => {
  const field = Field.create('updatedAt', 'DateTime')
  field.updatedAt()
  expect(field.toString()).toBe('updatedAt DateTime @updatedAt')
})

test('creates ignored field', () => {
  const field = Field.create('temp', 'String')
  field.ignoreField()
  expect(field.toString()).toBe('temp String @ignore')
})

test('creates commented out field', () => {
  const field = Field.create('old', 'String')
  field.commentedOutField()
  expect(field.toString()).toBe('// old String')
})

test('creates unsupported field', () => {
  const field = Field.create('custom', 'CustomType')
  field.unsupported()
  expect(field.toString()).toBe('custom Unsupported("CustomType")')
})

test('creates complex field with multiple attributes', () => {
  const field = Field.create('id', 'String')
  field.documentation('Primary key')
  
  const idDef = IdFieldDefinition.create().sortOrder('Desc').length(32).clustered(false)
  field.idField(idDef)
  
  field.default(DefaultValue.function(Function.create('uuid')))
  field.nativeType('db', 'VarChar', ['255'])
  
  const expected = '/// Primary key\nid String @id(sort: Desc, length: 32, clustered: false) @default(uuid()) @db.VarChar("255")'
  expect(field.toString()).toBe(expected)
})