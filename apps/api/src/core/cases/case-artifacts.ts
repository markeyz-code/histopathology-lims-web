import { Injectable } from '@nestjs/common';
import type { Block, Discipline, Slide } from '@lims/shared';

export interface CaseArtifacts {
  blocks: Block[];
  slides: Slide[];
}

export interface WorklistMetrics {
  total: number;
  pending: number;
  stained: number;
}

export interface CaseArtifactProvider {
  discipline: Discipline;
  load(caseId: string): Promise<CaseArtifacts>;
  metrics(caseIds: string[]): Promise<Map<string, WorklistMetrics>>;
}

@Injectable()
export class CaseArtifactRegistry {
  private readonly providers = new Map<Discipline, CaseArtifactProvider>();

  register(provider: CaseArtifactProvider): void {
    this.providers.set(provider.discipline, provider);
  }

  get(discipline: Discipline): CaseArtifactProvider | null {
    return this.providers.get(discipline) ?? null;
  }

  async load(discipline: Discipline, caseId: string): Promise<CaseArtifacts> {
    return (await this.get(discipline)?.load(caseId)) ?? { blocks: [], slides: [] };
  }

  async metrics(discipline: Discipline, caseIds: string[]): Promise<Map<string, WorklistMetrics>> {
    return (await this.get(discipline)?.metrics(caseIds)) ?? new Map();
  }
}
