import { Injectable, Logger } from '@nestjs/common';
import type { Discipline } from '@lims/shared';
import type { DisciplineDefinition } from './discipline-definition';

@Injectable()
export class DisciplineRegistry {
  private readonly logger = new Logger(DisciplineRegistry.name);
  private readonly definitions = new Map<Discipline, DisciplineDefinition>();

  register(definition: DisciplineDefinition): void {
    if (this.definitions.has(definition.id)) {
      this.logger.warn(`Discipline ${definition.id} is already registered; replacing.`);
    }
    this.definitions.set(definition.id, definition);
    this.logger.log(`Discipline registered: ${definition.id}`);
  }

  get(id: Discipline): DisciplineDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  require(id: Discipline): DisciplineDefinition {
    const definition = this.get(id);
    if (!definition) throw new Error(`Discipline ${id} is not registered.`);
    return definition;
  }

  all(): DisciplineDefinition[] {
    return Array.from(this.definitions.values());
  }

  enabled(enabledDisciplines: Discipline[]): DisciplineDefinition[] {
    return enabledDisciplines
      .map((id) => this.get(id))
      .filter((definition): definition is DisciplineDefinition => Boolean(definition));
  }
}
