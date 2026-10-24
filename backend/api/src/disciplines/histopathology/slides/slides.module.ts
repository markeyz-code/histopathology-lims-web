import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CaseModelName, CaseSchema } from '../../../core/cases/case.schema';
import { CustodyModule } from '../../../core/custody/custody.module';
import { SlideModelName, SlideSchema } from './slide.schema';
import { SlidesController } from './slides.controller';
import { SlidesService } from './slides.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SlideModelName, schema: SlideSchema },
      { name: BlockModelName, schema: BlockSchema },
      { name: CaseModelName, schema: CaseSchema },
    ]),
    CustodyModule,
  ],
  controllers: [SlidesController],
  providers: [SlidesService],
  exports: [SlidesService],
})
export class SlidesModule {}
