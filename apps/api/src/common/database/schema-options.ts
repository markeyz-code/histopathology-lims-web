/**
 * Shared schema options. The JSON transform adds a string `id` and removes
 * MongoDB internals and credential fields. Serializers still map documents to
 * explicit DTOs — the transform is a safety net, not the API contract.
 */
export function baseSchemaOptions(collection: string) {
  return {
    collection,
    timestamps: true,
    versionKey: false as const,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        const rawId = ret._id;
        if (rawId !== undefined && rawId !== null) ret.id = String(rawId);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        delete ret.labId;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        const rawId = ret._id;
        if (rawId !== undefined && rawId !== null) ret.id = String(rawId);
        return ret;
      },
    },
  };
}
