import {
  specimenLetter,
  type Block as BlockDto,
  type Protocol,
  type Slide as SlideDto,
} from '@lims/shared';
import { toIso } from '../../common/utils/format';
import { toWsiInfo } from '../../common/serializers/entities';
import type { BlockEntity } from './blocks/block.schema';
import type { ProtocolEntity } from './protocols/protocol.schema';
import type { SlideEntity } from './slides/slide.schema';

export function toBlock(block: BlockEntity): BlockDto {
  return {
    id: block._id.toString(),
    caseId: block.caseId.toString(),
    specimenId: block.specimenId.toString(),
    specimenLabel: specimenLetter(block.specimenSequence),
    blockNumber: block.blockNumber,
    label: block.label,
    barcode: block.barcode,
    grossDescription: block.grossDescription,
    status: block.status,
    currentStation: block.currentStation,
    slideCount: block.slideCount,
    lastEventAt: toIso(block.lastEventAt),
    createdAt: toIso(block.createdAt) ?? new Date().toISOString(),
  };
}

export { toSlide as ToSlide };

export function toSlide(slide: SlideEntity): SlideDto {
  return {
    id: slide._id.toString(),
    caseId: slide.caseId.toString(),
    specimenId: slide.specimenId.toString(),
    blockId: slide.blockId.toString(),
    blockLabel: slide.blockLabel,
    slideNumber: slide.slideNumber,
    label: slide.label,
    barcode: slide.barcode,
    stainType: slide.stainType,
    specialStain: slide.specialStain,
    status: slide.status,
    currentStation: slide.currentStation,
    recutOfSlideId: slide.recutOfSlideId ? slide.recutOfSlideId.toString() : null,
    requestReason: slide.requestReason,
    notes: slide.notes,
    stainRunId: slide.stainRunId ? slide.stainRunId.toString() : null,
    wsi: toWsiInfo(slide),
    lastEventAt: toIso(slide.lastEventAt),
    createdAt: toIso(slide.createdAt) ?? new Date().toISOString(),
  };
}

export function toProtocol(protocol: ProtocolEntity): Protocol {
  return {
    id: protocol._id.toString(),
    key: protocol.key,
    title: protocol.title,
    cancerType: protocol.cancerType,
    subspecialty: protocol.subspecialty,
    version: protocol.version,
    active: protocol.active,
    content: protocol.content,
    createdAt: toIso(protocol.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(protocol.updatedAt) ?? new Date().toISOString(),
  };
}
