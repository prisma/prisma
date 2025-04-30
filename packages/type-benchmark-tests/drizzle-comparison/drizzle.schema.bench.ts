import { bench } from '@ark/attest'
import { relations } from 'drizzle-orm'
import { date, doublePrecision, foreignKey, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core'

bench('drizzle schemas', () => {
  const customers = pgTable('customers', {
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

  const employees = pgTable(
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

  const orders = pgTable('orders', {
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

  const suppliers = pgTable('suppliers', {
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

  const products = pgTable('products', {
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

  const details = pgTable('order_details', {
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

  relations(orders, (r) => {
    return {
      details: r.many(details),
      products: r.many(products),
    }
  })

  relations(details, (r) => {
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

  relations(employees, (r) => {
    return {
      recipient: r.one(employees, {
        fields: [employees.recipientId],
        references: [employees.id],
      }),
    }
  })

  relations(products, (r) => {
    return {
      supplier: r.one(suppliers, {
        fields: [products.supplierId],
        references: [suppliers.id],
      }),
      order: r.one(orders),
    }
  })
}).types([54109, 'instantiations'])
