import { defineContract, field, index, model } from '@internal/mongo/contract-builder';

export const contract = defineContract({
  models: {
    Catalog: model('Catalog', {
      collection: 'catalog',
      controlPolicy: 'managed',
      fields: {
        _id: field.objectId(),
        sku: field.string(),
      },
      indexes: [index({ sku: 1 }, { unique: true })],
    }),

    AuditLog: model('AuditLog', {
      collection: 'audit_log',
      controlPolicy: 'tolerated',
      fields: {
        _id: field.objectId(),
        ts: field.string(),
      },
      indexes: [index({ ts: 1 })],
    }),

    AuthUsers: model('AuthUsers', {
      collection: 'auth_users',
      controlPolicy: 'external',
      fields: {
        _id: field.objectId(),
        email: field.string(),
      },
      indexes: [index({ email: 1 }, { unique: true })],
    }),

    LegacyJobs: model('LegacyJobs', {
      collection: 'legacy_jobs',
      controlPolicy: 'observed',
      fields: {
        _id: field.objectId(),
        status: field.string(),
      },
      indexes: [index({ status: 1 })],
    }),
  },
});
