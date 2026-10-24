import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Block, Slide } from '@lims/shared';
import { toBlock, toSlide } from './histopathology.serializers';
import { CaseArtifactRegistry, type WorklistMetrics } from '../../core/cases/case-artifacts';
import { BlockModelName, type BlockEntity } from './blocks/block.schema';
import { SlideModelName, type SlideEntity } from './slides/slide.schema';

@Injectable()
export class HistopathologyCaseArtifactsService implements OnModuleInit {
  constructor(
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    private readonly registry: CaseArtifactRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      discipline: 'HISTOPATHOLOGY',
      load: (caseId) => this.load(caseId),
      metrics: (caseIds) => this.metrics(caseIds),
    });
  }

  private async load(caseId: string): Promise<{ blocks: Block[]; slides: Slide[] }> {
    const [blocks, slides] = await Promise.all([
      this.blockModel.find({ caseId }).sort({ specimenSequence: 1, blockNumber: 1 }).exec(),
      this.slideModel.find({ caseId }).sort({ blockLabel: 1, slideNumber: 1 }).exec(),
    ]);
    return { blocks: blocks.map(toBlock), slides: slides.map(toSlide) };
  }

  private async metrics(caseIds: string[]): Promise<Map<string, WorklistMetrics>> {
    const counts = new Map<string, WorklistMetrics>();
    if (caseIds.length === 0) return counts;
    const slides = await this.slideModel
      .find({ caseId: { $in: caseIds } })
      .select('caseId status')
      .exec();
    for (const slide of slides) {
      const key = slide.caseId.toString();
      const entry = counts.get(key) ?? { total: 0, pending: 0, stained: 0 };
      entry.total += 1;
      if (slide.status === 'WITH_PATHOLOGIST' || slide.status === 'RECUT_REQUESTED') {
        entry.pending += 1;
      }
      if (slide.status === 'STAINED') entry.stained += 1;
      counts.set(key, entry);
    }
    return counts;
  }
}
