import { Types, type Aggregate, type Document, type Query, type Schema } from 'mongoose';
import { currentTenant, requireTenant, TenantContextMissingError } from '../context/tenant-context';

type UpdateDocument = Record<string, unknown> & {
  $set?: Record<string, unknown>;
  $setOnInsert?: Record<string, unknown>;
  $unset?: Record<string, unknown>;
  $rename?: Record<string, unknown>;
};

function containsLabId(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).some(
    (key) => key === 'labId' || key.startsWith('labId.'),
  );
}

function rejectLabIdMutation(update: unknown): void {
  if (update === null || update === undefined) return;
  if (Array.isArray(update)) {
    throw new Error('Aggregation-pipeline updates are not permitted on tenant collections.');
  }
  const doc = update as UpdateDocument;
  if (containsLabId(doc.$set) || containsLabId(doc.$setOnInsert) || containsLabId(doc.$unset)) {
    throw new Error('labId is immutable and cannot be changed by an update.');
  }
}

function applyTenantFilter(query: Query<unknown, unknown>): void {
  const store = currentTenant();
  if (store?.system) return;
  const tenant = requireTenant();
  const filter = query.getFilter() as Record<string, unknown>;
  filter.labId = new Types.ObjectId(tenant.labId);
  query.setQuery(filter);
}

/**
 * Multi-tenancy is enforced here, not by remembering `.where({ labId })` in every
 * service. Every plugin-enabled schema gets an immutable labId; every read and
 * write query is scoped to the async tenant context established from the JWT.
 *
 * There is no request body path that can set or override the tenant. The only
 * bypass is `runWithSystemTenant`, used for public verification and seeding.
 */
export function tenantPlugin(schema: Schema): void {
  schema.add({
    labId: {
      type: Types.ObjectId,
      ref: 'Lab',
      required: true,
      immutable: true,
      index: true,
    },
  });

  schema.pre(
    /^(find|count|distinct|update|delete|replace)/,
    function (this: Query<unknown, unknown>) {
      applyTenantFilter(this);
      const operation = (this as unknown as { op?: string }).op;
      if (operation && (operation.startsWith('update') || operation.startsWith('replace'))) {
        rejectLabIdMutation(this.getUpdate());
      }
    },
  );

  schema.pre('aggregate', function (this: Aggregate<unknown[]>) {
    const store = currentTenant();
    if (store?.system) return;
    const tenant = requireTenant();
    this.pipeline().unshift({ $match: { labId: new Types.ObjectId(tenant.labId) } });
  });

  schema.pre('validate', function (this: Document & { labId?: Types.ObjectId }) {
    const store = currentTenant();
    if (!this.isNew) {
      if (this.isModified('labId')) {
        throw new Error('labId is immutable.');
      }
      return;
    }

    if (!store) throw new TenantContextMissingError();

    if (!this.labId) {
      if (store.system && !store.labId) {
        throw new Error('System writes must provide an explicit labId.');
      }
      this.labId = new Types.ObjectId(store.labId);
      return;
    }

    if (!store.system && this.labId.toString() !== store.labId) {
      throw new Error('Cross-tenant write rejected.');
    }
  });

  schema.pre(
    'insertMany',
    function (this: unknown, next: (error?: Error) => void, docs: Array<Record<string, unknown>>) {
      const store = currentTenant();
      if (!store) {
        next(new TenantContextMissingError());
        return;
      }
      try {
        for (const doc of docs) {
          if (!doc.labId) {
            if (store.system && !store.labId) {
              throw new Error('System writes must provide an explicit labId.');
            }
            doc.labId = new Types.ObjectId(store.labId);
          } else if (!store.system && String(doc.labId) !== store.labId) {
            throw new Error('Cross-tenant write rejected.');
          }
        }
        next();
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)));
      }
    },
  );
}
