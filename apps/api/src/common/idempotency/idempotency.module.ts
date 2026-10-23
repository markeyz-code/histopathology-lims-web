import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyModelName, IdempotencySchema } from './idempotency.schema';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: IdempotencyModelName, schema: IdempotencySchema }])],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
