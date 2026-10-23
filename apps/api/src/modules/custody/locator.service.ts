import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PHYSICAL_STATE_LABELS,
  STATION_LABELS,
  type Block,
  type CustodyEvent,
  type LocatorResult,
  type PhysicalEntityType,
  type Slide,
  type Specimen,
} from '@lims/shared';
import { toBlock, toCustodyEvent, toSlide, toSpecimen } from '../../common/serializers/entities';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { SlideModelName, type SlideEntity } from '../slides/slide.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import { BarcodeResolverService } from './barcode-resolver.service';
import { CustodyService } from './custody.service';

@Injectable()
export class LocatorService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    private readonly barcodeResolver: BarcodeResolverService,
    private readonly custody: CustodyService,
  ) {}

  async locate(rawBarcode: string): Promise<LocatorResult> {
    const match = await this.barcodeResolver.resolve(rawBarcode);
    if (!match) {
      throw new NotFoundException(
        `No specimen, block or slide matches barcode ${rawBarcode.toUpperCase()}.`,
      );
    }

    const entity = match.entity;
    const caseDoc = await this.caseModel.findById(entity.caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found for this item.');
    const patient = await this.patientModel.findById(caseDoc.patientId).exec();
    if (!patient) throw new NotFoundException('Patient not found for this case.');

    let specimen: SpecimenEntity | null = null;
    let block: BlockEntity | null = null;
    let serialized: Specimen | Block | Slide;

    if (match.entityType === 'SPECIMEN') {
      specimen = match.entity as SpecimenEntity;
      serialized = toSpecimen(specimen);
    } else if (match.entityType === 'BLOCK') {
      block = match.entity as BlockEntity;
      specimen = await this.specimenModel.findById(block.specimenId).exec();
      serialized = toBlock(block);
    } else {
      const slide = match.entity as SlideEntity;
      block = await this.blockModel.findById(slide.blockId).exec();
      specimen = block ? await this.specimenModel.findById(block.specimenId).exec() : null;
      serialized = toSlide(slide);
    }

    const timeline = await this.custody.forEntity(match.entityType, entity._id.toString());

    const station = entity.currentStation;
    const currentLocation =
      station !== null
        ? { station, label: STATION_LABELS[station] }
        : entity.status === 'ARCHIVED'
          ? { station: null, label: 'Archive' }
          : { station: null, label: PHYSICAL_STATE_LABELS[entity.status] };

    return {
      entityType: match.entityType as PhysicalEntityType,
      entity: serialized,
      case: {
        id: caseDoc._id.toString(),
        accessionNumber: caseDoc.accessionNumber,
        status: caseDoc.status,
        priority: caseDoc.priority,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientMrn: patient.mrn,
        tatDeadline: caseDoc.tatDeadline.toISOString(),
      },
      specimen: specimen ? toSpecimen(specimen) : null,
      block: block ? toBlock(block) : null,
      timeline,
      currentLocation,
    };
  }

  async caseTimeline(caseId: string): Promise<CustodyEvent[]> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    return this.custody.forCase(caseId);
  }

  async entityTimeline(entityType: string, entityId: string): Promise<CustodyEvent[]> {
    const allowed = ['SPECIMEN', 'BLOCK', 'SLIDE'];
    if (!allowed.includes(entityType)) {
      throw new NotFoundException('Unknown custody entity type.');
    }
    const events = await this.custody.forEntity(
      entityType as 'SPECIMEN' | 'BLOCK' | 'SLIDE',
      entityId,
    );
    if (events.length === 0) throw new NotFoundException('No custody history for this item.');
    return events;
  }
}

void toCustodyEvent;
