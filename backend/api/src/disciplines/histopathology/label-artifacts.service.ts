import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { STAIN_TYPE_LABELS } from '@lims/shared';
import { LabelArtifactRegistry, type LabelArtifact } from '../../core/labels/label-artifacts';
import { BlockModelName, type BlockEntity } from './blocks/block.schema';
import { SlideModelName, type SlideEntity } from './slides/slide.schema';
import { SpecimenModelName, type SpecimenEntity } from '../../core/specimens/specimen.schema';

@Injectable()
export class HistopathologyLabelArtifactsService implements OnModuleInit {
  constructor(
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    private readonly registry: LabelArtifactRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      discipline: 'HISTOPATHOLOGY',
      entity: (type, id) => this.entity(type, id),
      forCase: (caseId) => this.forCase(caseId),
    });
  }

  private async entity(type: 'BLOCK' | 'SLIDE', id: string): Promise<LabelArtifact | null> {
    if (type === 'BLOCK') {
      const block = await this.blockModel.findById(id).exec();
      if (!block) return null;
      const specimen = await this.specimenModel.findById(block.specimenId).exec();
      return {
        kind: 'BLOCK',
        caseId: block.caseId.toString(),
        barcode: block.barcode,
        label: block.label,
        detail: specimen ? `${specimen.specimenType} · ${specimen.site}` : 'Block',
        date: block.createdAt,
      };
    }
    const slide = await this.slideModel.findById(id).exec();
    if (!slide) return null;
    return this.slideArtifact(slide);
  }

  private async forCase(caseId: string): Promise<LabelArtifact[]> {
    const [blocks, slides] = await Promise.all([
      this.blockModel.find({ caseId }).sort({ specimenSequence: 1, blockNumber: 1 }).exec(),
      this.slideModel.find({ caseId }).sort({ blockLabel: 1, slideNumber: 1 }).exec(),
    ]);
    const artifacts: LabelArtifact[] = [];
    for (const block of blocks) {
      const specimen = await this.specimenModel.findById(block.specimenId).exec();
      artifacts.push({
        kind: 'BLOCK',
        caseId: block.caseId.toString(),
        barcode: block.barcode,
        label: block.label,
        detail: specimen ? `${specimen.specimenType} · ${specimen.site}` : 'Block',
        date: block.createdAt,
      });
    }
    for (const slide of slides) artifacts.push(await this.slideArtifact(slide));
    return artifacts;
  }

  private async slideArtifact(slide: SlideEntity): Promise<LabelArtifact> {
    const specimen = await this.specimenModel.findById(slide.specimenId).exec();
    const stain = slide.specialStain
      ? `${STAIN_TYPE_LABELS[slide.stainType]} · ${slide.specialStain}`
      : STAIN_TYPE_LABELS[slide.stainType];
    return {
      kind: 'SLIDE',
      caseId: slide.caseId.toString(),
      barcode: slide.barcode,
      label: slide.label,
      detail: specimen ? `${specimen.specimenType} · ${stain}` : stain,
      date: slide.createdAt,
    };
  }
}
