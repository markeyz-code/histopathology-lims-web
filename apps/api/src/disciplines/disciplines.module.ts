import { Module, OnModuleInit } from '@nestjs/common';
import { DisciplineRegistry } from '../core/discipline/discipline.registry';
import { chemistryDefinition } from './chemistry/discipline';
import { haematologyDefinition } from './haematology/discipline';
import { histopathologyDefinition } from './histopathology/discipline';
import { microbiologyDefinition } from './microbiology/discipline';

@Module({})
export class DisciplinesModule implements OnModuleInit {
  constructor(private readonly registry: DisciplineRegistry) {}

  onModuleInit(): void {
    this.registry.register(histopathologyDefinition());
    this.registry.register(haematologyDefinition());
    this.registry.register(chemistryDefinition());
    this.registry.register(microbiologyDefinition());
  }
}
