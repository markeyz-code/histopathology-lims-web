import { Global, Module } from '@nestjs/common';
import { DisciplineRegistry } from './discipline.registry';

@Global()
@Module({
  providers: [DisciplineRegistry],
  exports: [DisciplineRegistry],
})
export class DisciplineRegistryModule {}
