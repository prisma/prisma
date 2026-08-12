#!/usr/bin/env -S node
import { collMod, Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration';
import type { Contract as Start } from '../../snapshots/9414a8f88a64f9decc0e019967459e49da083f011cf91898094b7bccab6c1810/contract';
import startContract from '../../snapshots/9414a8f88a64f9decc0e019967459e49da083f011cf91898094b7bccab6c1810/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/bd938b4f8a10c688bd32dc61ec1dd808dcf34e725f08505b39ce365a39c97e1b/contract';
import endContract from '../../snapshots/bd938b4f8a10c688bd32dc61ec1dd808dcf34e725f08505b39ce365a39c97e1b/contract.json' with {
  type: 'json',
};

class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      collMod(
        'orders',
        {
          validator: {
            $jsonSchema: {
              additionalProperties: false,
              bsonType: 'object',
              properties: {
                _id: { bsonType: 'objectId' },
                items: {
                  bsonType: 'array',
                  items: {
                    additionalProperties: false,
                    bsonType: 'object',
                    properties: {
                      amount: { bsonType: 'int' },
                      brand: { bsonType: 'string' },
                      image: {
                        additionalProperties: false,
                        bsonType: 'object',
                        properties: { url: { bsonType: 'string' } },
                        required: ['url'],
                      },
                      name: { bsonType: 'string' },
                      price: {
                        additionalProperties: false,
                        bsonType: 'object',
                        properties: {
                          amount: { bsonType: 'double' },
                          currency: { bsonType: 'string' },
                        },
                        required: ['amount', 'currency'],
                      },
                      productId: { bsonType: 'string' },
                    },
                    required: ['amount', 'brand', 'image', 'name', 'price', 'productId'],
                  },
                },
                shippingAddress: { bsonType: 'string' },
                statusHistory: {
                  bsonType: 'array',
                  items: {
                    additionalProperties: false,
                    bsonType: 'object',
                    properties: { status: { bsonType: 'string' }, timestamp: { bsonType: 'date' } },
                    required: ['status', 'timestamp'],
                  },
                },
                type: { bsonType: 'string', enum: ['delivery', 'pickup'] },
                userId: { bsonType: 'objectId' },
              },
              required: ['_id', 'items', 'shippingAddress', 'statusHistory', 'type', 'userId'],
            },
          },
          validationLevel: 'strict',
          validationAction: 'error',
        },
        {
          id: 'validator.orders.update',
          label: 'Update validator on orders',
          operationClass: 'destructive',
        },
      ),
      collMod(
        'products',
        {
          validator: {
            $jsonSchema: {
              additionalProperties: false,
              bsonType: 'object',
              properties: {
                _id: { bsonType: 'objectId' },
                articleType: { bsonType: 'string' },
                brand: { bsonType: 'string' },
                code: { bsonType: 'string' },
                description: { bsonType: 'string' },
                embedding: { bsonType: 'array', items: { bsonType: 'double' } },
                image: {
                  additionalProperties: false,
                  bsonType: 'object',
                  properties: { url: { bsonType: 'string' } },
                  required: ['url'],
                },
                name: { bsonType: 'string' },
                price: {
                  additionalProperties: false,
                  bsonType: 'object',
                  properties: { amount: { bsonType: 'double' }, currency: { bsonType: 'string' } },
                  required: ['amount', 'currency'],
                },
                primaryCategory: { bsonType: 'string' },
                status: { bsonType: 'string', enum: ['active', 'discontinued', 'out-of-stock'] },
                subCategory: { bsonType: 'string' },
              },
              required: [
                '_id',
                'articleType',
                'brand',
                'code',
                'description',
                'image',
                'name',
                'price',
                'primaryCategory',
                'status',
                'subCategory',
              ],
            },
          },
          validationLevel: 'strict',
          validationAction: 'error',
        },
        {
          id: 'validator.products.update',
          label: 'Update validator on products',
          operationClass: 'destructive',
        },
      ),
    ];
  }
}

export default M;
MigrationCLI.run(import.meta.url, M);
