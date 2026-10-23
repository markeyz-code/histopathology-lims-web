import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession, type HydratedDocument } from 'mongoose';
import { normalizeBarcode, type PhysicalEntityType } from '@lims/shared';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { SlideModelName, type SlideEntity } from '../slides/slide.schema';
import { SpecimenModelName, type SpecimenEntity } from '../../../core/specimens/specimen.schema';

export type AnyPhysicalEntity =
  HydratedDocument<SpecimenEntity> | HydratedDocument<BlockEntity> | HydratedDocument<SlideEntity>;

export interface BarcodeMatch {
  entityType: PhysicalEntityType;
  entity: AnyPhysicalEntity;
}

@Injectable()
export class BarcodeResolverService {
  constructor(
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
  ) {}

  async resolve(rawBarcode: string, session?: ClientSession): Promise<BarcodeMatch | null> {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode) return null;

    if (barcode.startsWith('SP-')) {
      const entity = await this.specimenModel
        .findOne({ barcode })
        .session(session ?? null)
        .exec();
      return entity ? { entityType: 'SPECIMEN', entity } : null;
    }
    if (barcode.startsWith('BL-')) {
      const entity = await this.blockModel
        .findOne({ barcode })
        .session(session ?? null)
        .exec();
      return entity ? { entityType: 'BLOCK', entity } : null;
    }
    if (barcode.startsWith('SL-')) {
      const entity = await this.slideModel
        .findOne({ barcode })
        .session(session ?? null)
        .exec();
      return entity ? { entityType: 'SLIDE', entity } : null;
    }

    // Manual entry or a non-standard label: search all three collections.
    const specimen = await this.specimenModel
      .findOne({ barcode })
      .session(session ?? null)
      .exec();
    if (specimen) return { entityType: 'SPECIMEN', entity: specimen };
    const block = await this.blockModel
      .findOne({ barcode })
      .session(session ?? null)
      .exec();
    if (block) return { entityType: 'BLOCK', entity: block };
    const slide = await this.slideModel
      .findOne({ barcode })
      .session(session ?? null)
      .exec();
    if (slide) return { entityType: 'SLIDE', entity: slide };
    return null;
  }
}
