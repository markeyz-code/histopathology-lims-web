import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WsiInfo } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { runWithTenant } from '../../common/context/tenant-context';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { ToSlide } from '../../common/serializers/entities';
import { SlideModelName, type SlideEntity } from '../slides/slide.schema';
import type { LinkWsiDto, WsiWebhookDto } from './dto/wsi.dto';

@Injectable()
export class WsiService {
  constructor(
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async link(slideId: string, dto: LinkWsiDto, user: AuthenticatedUser) {
    const slide = await this.slideModel.findById(slideId).exec();
    if (!slide) throw new NotFoundException('Slide not found.');
    const now = new Date();
    slide.wsiStatus = 'LINKED';
    slide.wsiUrl = dto.url;
    slide.wsiViewerUrl = dto.viewerUrl ?? dto.url;
    slide.wsiScanner = dto.scanner?.trim() || null;
    slide.wsiMagnification = dto.magnification?.trim() || null;
    slide.wsiAddedAt = now;
    slide.wsiAddedBy = new Types.ObjectId(user.id);
    slide.wsiMetadata = dto.notes ? { notes: dto.notes.trim() } : {};
    await slide.save();
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'Slide',
      entityId: slide._id.toString(),
      caseId: slide.caseId.toString(),
      after: { wsiStatus: slide.wsiStatus, url: slide.wsiUrl },
      metadata: { event: 'wsi-linked' },
    });
    return { slide: ToSlide(slide), wsi: toWsi(slide) };
  }

  async byBarcode(barcode: string) {
    const slide = await this.slideModel.findOne({ barcode: barcode.trim().toUpperCase() }).exec();
    if (!slide) throw new NotFoundException('Slide not found.');
    const caseDoc = await this.caseModel.findById(slide.caseId).exec();
    return {
      slide: ToSlide(slide),
      wsi: toWsi(slide),
      accessionNumber: caseDoc?.accessionNumber ?? null,
    };
  }

  async webhook(dto: WsiWebhookDto, signature: string | undefined) {
    const secret = this.config.get<string>('WSI_WEBHOOK_SECRET');
    if (!secret) {
      throw new ForbiddenException('WSI webhooks are not configured for this deployment.');
    }
    const expected = createHmac('sha256', secret).update(JSON.stringify(dto)).digest('hex');
    if (!signature || !safeEqual(signature, expected)) {
      throw new ForbiddenException('Invalid WSI webhook signature.');
    }
    const lab = dto.labCode
      ? await this.labModel.findOne({ code: dto.labCode.toUpperCase(), active: true }).exec()
      : null;
    if (!lab) throw new BadRequestException('A valid labCode is required on the WSI webhook.');
    return runWithTenant({ labId: lab._id.toString() }, async () => {
      const slide = await this.slideModel
        .findOne({ barcode: dto.barcode.trim().toUpperCase() })
        .exec();
      if (!slide) throw new NotFoundException('Slide barcode does not exist in this laboratory.');
      slide.wsiStatus = dto.status ?? 'LINKED';
      slide.wsiUrl = dto.url;
      slide.wsiViewerUrl = dto.url;
      slide.wsiScanner = dto.scanner?.trim() || null;
      slide.wsiAddedAt = new Date();
      slide.wsiMetadata = dto.metadata ?? {};
      await slide.save();
      await this.audit.record({
        action: 'WEBHOOK',
        entityType: 'Slide',
        entityId: slide._id.toString(),
        caseId: slide.caseId.toString(),
        after: { wsiStatus: slide.wsiStatus, url: slide.wsiUrl },
        metadata: { source: 'wsi-scanner' },
      });
      return { slide: ToSlide(slide), wsi: toWsi(slide) };
    });
  }
}

function toWsi(slide: SlideEntity): WsiInfo | null {
  if (!slide.wsiStatus) return null;
  return {
    status: slide.wsiStatus as WsiInfo['status'],
    url: slide.wsiUrl ?? null,
    viewerUrl: slide.wsiViewerUrl ?? null,
    scanner: slide.wsiScanner ?? null,
    magnification: slide.wsiMagnification ?? null,
    addedAt: slide.wsiAddedAt ? slide.wsiAddedAt.toISOString() : null,
    addedBy: slide.wsiAddedBy ? slide.wsiAddedBy.toString() : null,
    metadata: slide.wsiMetadata ?? {},
  };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
