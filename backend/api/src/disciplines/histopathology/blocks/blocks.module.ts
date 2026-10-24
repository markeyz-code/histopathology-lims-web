import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../../../core/cases/case.schema';
import { CustodyModule } from '../../../core/custody/custody.module';
import { SpecimenModelName, SpecimenSchema } from '../../../core/specimens/specimen.schema';
import { BlockModelName, BlockSchema } from './block.schema';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockModelName, schema: BlockSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: CaseModelName, schema: CaseSchema },
    ]),
    CustodyModule,
  ],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
