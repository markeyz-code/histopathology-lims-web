import { Injectable } from '@nestjs/common';
import type { Discipline } from '@lims/shared';

export interface LabelArtifact {
  kind: 'BLOCK' | 'SLIDE';
  caseId: string;
  barcode: string;
  label: string;
  detail: string;
  date: Date;
}

export interface LabelArtifactProvider {
  discipline: Discipline;
  entity(type: 'BLOCK' | 'SLIDE', id: string): Promise<LabelArtifact | null>;
  forCase(caseId: string): Promise<LabelArtifact[]>;
}

@Injectable()
export class LabelArtifactRegistry {
  private readonly providers = new Map<Discipline, LabelArtifactProvider>();

  register(provider: LabelArtifactProvider): void {
    this.providers.set(provider.discipline, provider);
  }

  get(discipline: Discipline = 'HISTOPATHOLOGY'): LabelArtifactProvider | null {
    return this.providers.get(discipline) ?? null;
  }

  async forCase(
    caseId: string,
    discipline: Discipline = 'HISTOPATHOLOGY',
  ): Promise<LabelArtifact[]> {
    return (await this.get(discipline)?.forCase(caseId)) ?? [];
  }
}
