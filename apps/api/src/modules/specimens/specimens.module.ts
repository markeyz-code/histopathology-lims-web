import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyModule } from '../custody/custody.module';
import { SpecimenModelName, SpecimenSchema } from './specimen.schema';
import { SpecimensController } from './specimens.controller';
import { SpecimensService } from './specimens.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: CaseModelName, schema: CaseSchema },
    ]),
    CustodyModule,
  ],
  controllers: [SpecimensController],
  providers: [SpecimensService],
  exports: [SpecimensService],
})
export class SpecimensModule {}
