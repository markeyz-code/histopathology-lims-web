import { Global, Injectable, Module } from '@nestjs/common';
import type { Discipline, ProtocolContent } from '@lims/shared';
import type { ClientSession } from 'mongoose';
import type { Actor } from '../../common/utils/actor';

export interface ProtocolRecord {
  _id: { toString(): string };
  key: string;
  title: string;
  cancerType: string;
  subspecialty: string;
  version: number;
  active: boolean;
  content: ProtocolContent;
}

export interface ProtocolCatalog {
  findById(protocolId: string, session: ClientSession): Promise<ProtocolRecord | null>;
}

export interface GeneratedPdf {
  path: string;
  filename: string;
  version: number;
}

export interface ReportRenderer {
  generateAndStore(reportId: string): Promise<GeneratedPdf>;
  getOrGenerate(reportId: string): Promise<GeneratedPdf>;
}

export interface ReportFinalizer {
  markReported(caseId: string, actor: Actor, session: ClientSession): Promise<void>;
}

export interface ReportPorts {
  protocols?: ProtocolCatalog;
  renderer?: ReportRenderer;
  finalizer?: ReportFinalizer;
}

@Injectable()
export class ReportPortRegistry {
  private readonly ports = new Map<Discipline, ReportPorts>();

  register(discipline: Discipline, ports: ReportPorts): void {
    this.ports.set(discipline, { ...this.ports.get(discipline), ...ports });
  }

  protocols(discipline: Discipline = 'HISTOPATHOLOGY'): ProtocolCatalog | null {
    return this.ports.get(discipline)?.protocols ?? null;
  }

  renderer(discipline: Discipline = 'HISTOPATHOLOGY'): ReportRenderer | null {
    return this.ports.get(discipline)?.renderer ?? null;
  }

  finalizer(discipline: Discipline = 'HISTOPATHOLOGY'): ReportFinalizer | null {
    return this.ports.get(discipline)?.finalizer ?? null;
  }
}

@Global()
@Module({
  providers: [ReportPortRegistry],
  exports: [ReportPortRegistry],
})
export class ReportPortsModule {}
