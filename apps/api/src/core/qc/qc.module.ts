import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModelName, UserSchema } from '../users/user.schema';
import { QcController } from './qc.controller';
import { QcService } from './qc.service';
import { QcMaterialModelName, QcMaterialSchema, QcRunModelName, QcRunSchema } from './qc.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QcMaterialModelName, schema: QcMaterialSchema },
      { name: QcRunModelName, schema: QcRunSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
  ],
  controllers: [QcController],
  providers: [QcService],
  exports: [QcService],
})
export class QcModule {}
