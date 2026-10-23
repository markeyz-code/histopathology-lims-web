import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import { IdempotencyModelName, type IdempotencyEntity } from './idempotency.schema';

export interface IdempotentResult<T> {
  value: T;
  duplicate: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyModelName)
    private readonly model: Model<IdempotencyEntity>,
  ) {}

  hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  async run<T>(
    key: string,
    requestHash: string,
    scope: string,
    work: () => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    const existing = await this.model.findOne({ key, scope }).exec();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('This idempotency key was used for a different request.');
      }
      if (existing.status === 'COMPLETED') {
        return { value: existing.response as T, duplicate: true };
      }
      throw new ConflictException('This request is already being processed. Retry shortly.');
    }

    try {
      await this.model.create({
        key,
        scope,
        requestHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const concurrent = await this.model.findOne({ key, scope }).exec();
        if (concurrent?.status === 'COMPLETED') {
          return { value: concurrent.response as T, duplicate: true };
        }
        throw new ConflictException('This request is already being processed. Retry shortly.');
      }
      throw error;
    }

    try {
      const value = await work();
      await this.model
        .updateOne(
          { key, scope },
          { $set: { status: 'COMPLETED', response: value, statusCode: 200 } },
        )
        .exec();
      return { value, duplicate: false };
    } catch (error) {
      await this.model.deleteOne({ key, scope }).exec();
      throw error;
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}
