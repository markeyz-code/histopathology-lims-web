import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabModelName, LabSchema } from './lab.schema';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: LabModelName, schema: LabSchema }])],
  controllers: [LabsController],
  providers: [LabsService],
  exports: [LabsService],
})
export class LabsModule {}
