import { expect, test } from 'vitest'
import { Model, IndexDefinition, IdDefinition } from '../model'
import { Field, IdFieldDefinition } from '../field'
import { DefaultValue } from '../default-value'
import { Function } from '../../values'

test('creates basic model', () => {
  const model = Model.create('User')
  expect(model.toString()).toBe('model User {\n}\n')
  expect(model.getName()).toBe('User')
})

test('creates model with documentation', () => {
  const model = Model.create('User')
  model.documentation('User model for authentication')
  expect(model.toString()).toBe('/// User model for authentication\nmodel User {\n}\n')
})

test('creates model with field', () => {
  const model = Model.create('User')
  const field = Field.create('id', 'Int')
  field.idField(IdFieldDefinition.create())
  model.pushField(field)
  
  expect(model.toString()).toBe('model User {\n  id Int @id\n}\n')
})

test('creates model with multiple fields', () => {
  const model = Model.create('User')
  
  const idField = Field.create('id', 'Int')
  idField.idField(IdFieldDefinition.create())
  idField.default(DefaultValue.function(Function.create('autoincrement')))
  model.pushField(idField)
  
  const nameField = Field.create('name', 'String')
  model.pushField(nameField)
  
  const emailField = Field.create('email', 'String')
  emailField.optional()
  model.pushField(emailField)
  
  const expected = `model User {
  id Int @id @default(autoincrement())
  name String
  email String?
}
`
  expect(model.toString()).toBe(expected)
})

test('creates model with map attribute', () => {
  const model = Model.create('User')
  model.mapModel('users')
  expect(model.toString()).toBe('model User {\n  @@map("users")\n}\n')
})

test('creates model with schema attribute', () => {
  const model = Model.create('User')
  model.schemaAttribute('public')
  expect(model.toString()).toBe('model User {\n  @@schema("public")\n}\n')
})

test('creates model with ignore attribute', () => {
  const model = Model.create('User')
  model.ignoreModel()
  expect(model.toString()).toBe('model User {\n  @@ignore\n}\n')
})

test('creates model with index', () => {
  const model = Model.create('User')
  
  const field = Field.create('email', 'String')
  model.pushField(field)
  
  const index = IndexDefinition.unique([{ name: 'email' }])
  model.pushIndex(index)
  
  expect(model.toString()).toBe('model User {\n  email String\n  @@unique([email])\n}\n')
})

test('creates model with compound index', () => {
  const model = Model.create('User')
  
  const nameField = Field.create('firstName', 'String')
  const lastField = Field.create('lastName', 'String')
  model.pushField(nameField)
  model.pushField(lastField)
  
  const index = IndexDefinition.index([
    { name: 'firstName' },
    { name: 'lastName', sortOrder: 'Asc', length: 32 }
  ])
  index.name('full_name_idx')
  model.pushIndex(index)
  
  expect(model.toString()).toBe('model User {\n  firstName String\n  lastName String\n  @@index([firstName, lastName(sort: Asc, length: 32)], name: "full_name_idx")\n}\n')
})

test('creates model with compound ID', () => {
  const model = Model.create('UserRole')
  
  const userField = Field.create('userId', 'Int')
  const roleField = Field.create('roleId', 'Int')
  model.pushField(userField)
  model.pushField(roleField)
  
  const id = IdDefinition.create([
    { name: 'userId' },
    { name: 'roleId', sortOrder: 'Desc' }
  ])
  id.name('primary').map('PK_user_role').clustered(false)
  model.idDefinition(id)
  
  expect(model.toString()).toBe('model UserRole {\n  userId Int\n  roleId Int\n  @@id([userId, roleId(sort: Desc)], name: "primary", map: "PK_user_role", clustered: false)\n}\n')
})

test('creates commented out model', () => {
  const model = Model.create('User')
  model.commentOut()
  
  const field = Field.create('id', 'Int')
  field.idField(IdFieldDefinition.create())
  model.pushField(field)
  
  model.schemaAttribute('public')
  
  expect(model.toString()).toBe('// model User {\n// id Int @id\n//   @@schema("public")\n// }\n')
})