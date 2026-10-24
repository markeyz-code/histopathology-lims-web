import type { Document, Schema } from 'mongoose';

/**
 * Makes a collection append-only at the ODM layer: documents can be inserted,
 * but save/update/delete calls are rejected. Custody events, audit logs and
 * signed report versions must never be rewritten.
 */
export function makeAppendOnly(schema: Schema, label: string): void {
  schema.pre('save', function (this: Document) {
    if (!this.isNew) {
      throw new Error(`${label} is append-only and cannot be modified.`);
    }
  });

  schema.pre(/^(update|delete|replace|findOneAnd)/, function () {
    throw new Error(`${label} is append-only and cannot be updated or deleted.`);
  });
}
