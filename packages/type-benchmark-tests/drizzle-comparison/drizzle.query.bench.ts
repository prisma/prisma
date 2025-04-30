import { bench } from '@ark/attest'
import { asc, eq, ilike, relations, sql } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { alias, date, doublePrecision, foreignKey, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core'

declare const drizzle: NodePgDatabase

export const customers = pgTable('customers', {
  id: varchar('id', { length: 5 }).primaryKey().notNull(),
  companyName: varchar('company_name').notNull(),
  contactName: varchar('contact_name').notNull(),
  contactTitle: varchar('contact_title').notNull(),
  address: varchar('address').notNull(),
  city: varchar('city').notNull(),
  postalCode: varchar('postal_code'),
  region: varchar('region'),
  country: varchar('country').notNull(),
  phone: varchar('phone').notNull(),
  fax: varchar('fax'),
})

export const employees = pgTable(
  'employees',
  {
    id: varchar('id').primaryKey().notNull(),
    lastName: varchar('last_name').notNull(),
    firstName: varchar('first_name'),
    title: varchar('title').notNull(),
    titleOfCourtesy: varchar('title_of_courtesy').notNull(),
    birthDate: date('birth_date', { mode: 'date' }).notNull(),
    hireDate: date('hire_date', { mode: 'date' }).notNull(),
    address: varchar('address').notNull(),
    city: varchar('city').notNull(),
    postalCode: varchar('postal_code').notNull(),
    country: varchar('country').notNull(),
    homePhone: varchar('home_phone').notNull(),
    extension: integer('extension').notNull(),
    notes: text('notes').notNull(),
    recipientId: varchar('recipient_id'),
  },
  (table) => ({
    recipientFk: foreignKey({
      columns: [table.recipientId],
      foreignColumns: [table.id],
    }),
  }),
)

export const orders = pgTable('orders', {
  id: varchar('id').primaryKey().notNull(),
  orderDate: date('order_date', { mode: 'date' }).notNull(),
  requiredDate: date('required_date', { mode: 'date' }).notNull(),
  shippedDate: date('shipped_date', { mode: 'date' }),
  shipVia: integer('ship_via').notNull(),
  freight: doublePrecision('freight').notNull(),
  shipName: varchar('ship_name').notNull(),
  shipCity: varchar('ship_city').notNull(),
  shipRegion: varchar('ship_region'),
  shipPostalCode: varchar('ship_postal_code'),
  shipCountry: varchar('ship_country').notNull(),

  customerId: varchar('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),

  employeeId: varchar('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
})

export const suppliers = pgTable('suppliers', {
  id: varchar('id').primaryKey().notNull(),
  companyName: varchar('company_name').notNull(),
  contactName: varchar('contact_name').notNull(),
  contactTitle: varchar('contact_title').notNull(),
  address: varchar('address').notNull(),
  city: varchar('city').notNull(),
  region: varchar('region'),
  postalCode: varchar('postal_code').notNull(),
  country: varchar('country').notNull(),
  phone: varchar('phone').notNull(),
})

export const products = pgTable('products', {
  id: varchar('id').primaryKey().notNull(),
  name: varchar('name').notNull(),
  quantityPerUnit: varchar('qt_per_unit').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  unitsInStock: integer('units_in_stock').notNull(),
  unitsOnOrder: integer('units_on_order').notNull(),
  reorderLevel: integer('reorder_level').notNull(),
  discontinued: integer('discontinued').notNull(),

  supplierId: varchar('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
})

export const details = pgTable('order_details', {
  unitPrice: doublePrecision('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  discount: doublePrecision('discount').notNull(),

  orderId: varchar('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),

  productId: varchar('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
})

export const ordersRelations = relations(orders, (r) => {
  return {
    details: r.many(details),
    products: r.many(products),
  }
})

export const detailsRelations = relations(details, (r) => {
  return {
    order: r.one(orders, {
      fields: [details.orderId],
      references: [orders.id],
    }),
    product: r.one(products, {
      fields: [details.productId],
      references: [products.id],
    }),
  }
})

export const employeesRelations = relations(employees, (r) => {
  return {
    recipient: r.one(employees, {
      fields: [employees.recipientId],
      references: [employees.id],
    }),
  }
})

export const productsRelations = relations(products, (r) => {
  return {
    supplier: r.one(suppliers, {
      fields: [products.supplierId],
      references: [suppliers.id],
    }),
    order: r.one(orders),
  }
})

// trivial getAll expressions moved to baseline, otherwise they incur
// a base penalty of ~6000 instantiations
bench.baseline(async () => {
  await drizzle.select().from(customers)
  await drizzle.select().from(employees)
  await drizzle.select().from(suppliers)
  await drizzle.select().from(products)
  await drizzle.select().from(orders)
})

bench('Customers: getInfo', async () => {
  await drizzle.select().from(customers).where(eq(customers.id, 'id1'))
}).types([921, 'instantiations'])

bench('Customers: search', async () => {
  await drizzle.select().from(customers).where(ilike(customers.companyName, `search2`))
}).types([856, 'instantiations'])

bench('Employees: getInfo', async () => {
  const e2 = alias(employees, 'recipient')

  await drizzle.select().from(employees).leftJoin(e2, eq(e2.id, employees.recipientId)).where(eq(employees.id, 'id2'))
}).types([22461, 'instantiations'])

bench('Suppliers: getInfo', async () => {
  await drizzle.select().from(suppliers).where(eq(suppliers.id, 'id3'))
}).types([881, 'instantiations'])

bench('Products: getInfo', async () => {
  await drizzle
    .select()
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(eq(products.id, 'id4'))
}).types([2430, 'instantiations'])

bench('Products: search', async () => {
  await drizzle.select().from(products).where(ilike(products.name, `search1`))
}).types([782, 'instantiations'])

bench('Orders: getAll', async () => {
  await drizzle
    .select({
      id: orders.id,
      shippedDate: orders.shippedDate,
      shipName: orders.shipName,
      shipCity: orders.shipCity,
      shipCountry: orders.shipCountry,
      productsCount: sql`count(${details.productId})`.as<number>(),
      quantitySum: sql`sum(${details.quantity})`.as<number>(),
      totalPrice: sql`sum(${details.quantity} * ${details.unitPrice})`.as<number>(),
    })
    .from(orders)
    .leftJoin(details, eq(orders.id, details.orderId))
    .groupBy(orders.id)
    .orderBy(asc(orders.id))
}).types([2890, 'instantiations'])

bench('Orders: getById', async () => {
  await drizzle
    .select({
      id: orders.id,
      shippedDate: orders.shippedDate,
      shipName: orders.shipName,
      shipCity: orders.shipCity,
      shipCountry: orders.shipCountry,
      productsCount: sql`count(${details.productId})`.as<number>(),
      quantitySum: sql`sum(${details.quantity})`.as<number>(),
      totalPrice: sql`sum(${details.quantity} * ${details.unitPrice})`.as<number>(),
    })
    .from(orders)
    .leftJoin(details, eq(orders.id, details.orderId))
    .where(eq(orders.id, 'id5'))
    .groupBy(orders.id)
    .orderBy(asc(orders.id))
}).types([3242, 'instantiations'])

bench('Orders: getInfo', async () => {
  await drizzle
    .select()
    .from(orders)
    .leftJoin(details, eq(orders.id, details.orderId))
    .leftJoin(products, eq(details.productId, products.id))
    .where(eq(orders.id, 'id6'))
}).types([3941, 'instantiations'])
