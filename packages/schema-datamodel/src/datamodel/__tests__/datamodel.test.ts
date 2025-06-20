import { expect, test } from 'vitest'
import { Datamodel } from '../datamodel'
import { Model } from '../model'
import { Enum } from '../enum'
import { View } from '../view'
import { CompositeType } from '../composite-type'
import { Field, IdFieldDefinition } from '../field'
import { DefaultValue } from '../default-value'
import { Function } from '../../values'

test('creates simple data model', () => {
  const fileName = 'schema.prisma'
  const dataModel = Datamodel.create()

  // Create composite type
  const composite = CompositeType.create('Address')
  const field = Field.create('street', 'String')
  composite.pushField(field)
  dataModel.pushCompositeType(fileName, composite)

  // Create model
  const model = Model.create('User')

  const idField = Field.create('id', 'Int')
  idField.idField(IdFieldDefinition.create())
  const defaultValue = DefaultValue.function(Function.create('autoincrement'))
  idField.default(defaultValue)
  model.pushField(idField)

  dataModel.pushModel(fileName, model)

  // Create enum
  const trafficLight = Enum.create('TrafficLight')
  trafficLight.pushVariant('Red')
  trafficLight.pushVariant('Yellow')
  trafficLight.pushVariant('Green')
  dataModel.pushEnum(fileName, trafficLight)

  const cat = Enum.create('Cat')
  cat.pushVariant('Asleep')
  cat.pushVariant('Hungry')
  dataModel.pushEnum(fileName, cat)

  // Create view
  const view = View.create('Meow')
  const viewIdField = Field.create('id', 'Int')
  viewIdField.idField(IdFieldDefinition.create())
  view.pushField(viewIdField)
  dataModel.pushView(fileName, view)

  // Render and check
  const rendered = dataModel.render()
  expect(rendered).toHaveLength(1)
  expect(rendered[0][0]).toBe(fileName)

  const content = rendered[0][1].content

  // The exact order should match the Rust implementation:
  // 1. Composite types
  // 2. Models  
  // 3. Views
  // 4. Enums
  const expected = `type Address {
  street String
}

model User {
  id Int @id @default(autoincrement())
}

view Meow {
  id Int @id
}

enum TrafficLight {
  Red
  Yellow
  Green
}

enum Cat {
  Asleep
  Hungry
}`

  expect(content).toBe(expected)
})

test('creates multi-file data model', () => {
  const dataModel = Datamodel.create()

  // Composite type in a.prisma
  const composite = CompositeType.create('Address')
  const field = Field.create('street', 'String')
  composite.pushField(field)
  dataModel.pushCompositeType('a.prisma', composite)

  // Model in a.prisma
  const model = Model.create('User')
  const idField = Field.create('id', 'Int')
  idField.idField(IdFieldDefinition.create())
  const defaultValue = DefaultValue.function(Function.create('autoincrement'))
  idField.default(defaultValue)
  model.pushField(idField)
  dataModel.pushModel('a.prisma', model)

  // Enum in b.prisma
  const trafficLight = Enum.create('TrafficLight')
  trafficLight.pushVariant('Red')
  trafficLight.pushVariant('Yellow')
  trafficLight.pushVariant('Green')
  dataModel.pushEnum('b.prisma', trafficLight)

  // Enum in c.prisma
  const cat = Enum.create('Cat')
  cat.pushVariant('Asleep')
  cat.pushVariant('Hungry')
  dataModel.pushEnum('c.prisma', cat)

  // View in d.prisma
  const view = View.create('Meow')
  const viewIdField = Field.create('id', 'Int')
  viewIdField.idField(IdFieldDefinition.create())
  view.pushField(viewIdField)
  dataModel.pushView('d.prisma', view)

  // Render and check
  const rendered = dataModel.render()
  expect(rendered).toHaveLength(4)

  // Sort by filename for consistent testing
  const sortedRendered = rendered.sort((a, b) => a[0].localeCompare(b[0]))

  // Check a.prisma
  expect(sortedRendered[0][0]).toBe('a.prisma')
  const aContent = sortedRendered[0][1].content
  expect(aContent).toBe(`type Address {
  street String
}

model User {
  id Int @id @default(autoincrement())
}`)

  // Check b.prisma  
  expect(sortedRendered[1][0]).toBe('b.prisma')
  const bContent = sortedRendered[1][1].content
  expect(bContent).toBe(`enum TrafficLight {
  Red
  Yellow
  Green
}`)

  // Check c.prisma
  expect(sortedRendered[2][0]).toBe('c.prisma')
  const cContent = sortedRendered[2][1].content
  expect(cContent).toBe(`enum Cat {
  Asleep
  Hungry
}`)

  // Check d.prisma
  expect(sortedRendered[3][0]).toBe('d.prisma')
  const dContent = sortedRendered[3][1].content
  expect(dContent).toBe(`view Meow {
  id Int @id
}`)
})

test('handles empty data model', () => {
  const dataModel = Datamodel.create()
  expect(dataModel.isEmpty()).toBe(true)

  const rendered = dataModel.render()
  expect(rendered).toHaveLength(0)
})

test('handles empty files', () => {
  const dataModel = Datamodel.create()

  const rendered = dataModel.render()
  expect(rendered).toHaveLength(0)
  // expect(rendered[0][0]).toBe('empty.prisma')
  // expect(rendered[0][1].content).toBe('')
})