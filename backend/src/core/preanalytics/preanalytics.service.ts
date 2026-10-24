import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  collectionCentreSchema,
  consignmentSchema,
  receiveConsignmentSchema,
  type CollectionCentre,
  type Consignment,
} from '@lims/shared';
import { makeBarcode } from '../../common/utils/crypto';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import { TestRequestModelName, type TestRequestEntity } from '../test-requests/test-request.schema';
import {
  CollectionCentreModelName,
  ConsignmentModelName,
  type CollectionCentreEntity,
  type ConsignmentEntity,
} from './preanalytics.schema';

@Injectable()
export class PreanalyticsService {
  constructor(
    @InjectModel(CollectionCentreModelName)
    private readonly centreModel: Model<CollectionCentreEntity>,
    @InjectModel(ConsignmentModelName) private readonly consignmentModel: Model<ConsignmentEntity>,
    @InjectModel(TestRequestModelName) private readonly requestModel: Model<TestRequestEntity>,
    private readonly audit: AuditService,
  ) {}

  async centres(): Promise<CollectionCentre[]> {
    const centres = await this.centreModel.find({}).sort({ name: 1 }).exec();
    return centres.map((centre) => this.toCentre(centre));
  }

  async createCentre(body: unknown, actor: Actor): Promise<CollectionCentre> {
    const parsed = collectionCentreSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const existing = await this.centreModel
      .findOne({ code: parsed.data.code.toUpperCase() })
      .exec();
    if (existing) throw new ConflictException('A collection centre with this code already exists.');
    const centre = await this.centreModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      homeCollection: parsed.data.homeCollection ?? false,
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'CollectionCentre',
      entityId: centre._id.toString(),
      after: this.toCentre(centre),
      metadata: { actor: actor.userName },
    });
    return this.toCentre(centre);
  }

  async consignments(): Promise<Consignment[]> {
    const consignments = await this.consignmentModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return Promise.all(consignments.map((consignment) => this.toConsignment(consignment)));
  }

  async createConsignment(body: unknown, actor: Actor): Promise<Consignment> {
    const parsed = consignmentSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const centre = await this.centreModel.findById(parsed.data.centreId).exec();
    if (!centre) throw new NotFoundException('Collection centre not found.');
    const requestIds = parsed.data.testRequestIds.map((id) => new Types.ObjectId(id));
    const requests = await this.requestModel.find({ _id: { $in: requestIds } }).exec();
    if (requests.length !== requestIds.length)
      throw new NotFoundException('One or more test requests were not found.');
    if (
      requests.some((request) => request.status === 'RELEASED' || request.status === 'CANCELLED')
    ) {
      throw new ConflictException('Closed test requests cannot be added to a consignment.');
    }
    const code = makeBarcode('CN');
    const consignment = await this.consignmentModel.create({
      code,
      centreId: centre._id,
      testRequestIds: requestIds,
      riderName: parsed.data.riderName ?? null,
      riderPhone: parsed.data.riderPhone ?? null,
      notes: parsed.data.notes ?? null,
      status: 'CREATED',
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    await this.requestModel.updateMany(
      { _id: { $in: requestIds } },
      { $set: { consignmentId: consignment._id, collectionCentreId: centre._id } },
    );
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Consignment',
      entityId: consignment._id.toString(),
      after: await this.toConsignment(consignment),
      metadata: { actor: actor.userName },
    });
    return this.toConsignment(consignment);
  }

  async dispatch(id: string, actor: Actor): Promise<Consignment> {
    const consignment = await this.consignmentModel.findById(id).exec();
    if (!consignment) throw new NotFoundException('Consignment not found.');
    if (consignment.status === 'RECEIVED' || consignment.status === 'REJECTED') {
      throw new ConflictException('This consignment is already closed.');
    }
    consignment.status = 'DISPATCHED';
    consignment.dispatchedAt = new Date();
    await consignment.save();
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'Consignment',
      entityId: consignment._id.toString(),
      after: { status: consignment.status },
      metadata: { actor: actor.userName, handoff: true },
    });
    return this.toConsignment(consignment);
  }

  async receive(id: string, body: unknown, actor: Actor): Promise<Consignment> {
    const parsed = receiveConsignmentSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const consignment = await this.consignmentModel.findById(id).exec();
    if (!consignment) throw new NotFoundException('Consignment not found.');
    if (consignment.status === 'RECEIVED' || consignment.status === 'REJECTED') {
      throw new ConflictException('This consignment is already closed.');
    }
    if (!parsed.data.accepted && !parsed.data.rejectionReason) {
      throw new BadRequestException('A rejection reason is required.');
    }
    consignment.status = parsed.data.accepted ? 'RECEIVED' : 'REJECTED';
    consignment.receivedAt = new Date();
    if (!parsed.data.accepted) {
      consignment.rejectedAt = new Date();
      consignment.rejectionReason = parsed.data.rejectionReason ?? null;
    }
    await consignment.save();
    await this.requestModel.updateMany(
      { _id: { $in: consignment.testRequestIds } },
      { $set: { status: parsed.data.accepted ? 'RECEIVED' : 'CANCELLED' } },
    );
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'Consignment',
      entityId: consignment._id.toString(),
      after: { status: consignment.status },
      metadata: { actor: actor.userName, rejectionReason: consignment.rejectionReason },
    });
    return this.toConsignment(consignment);
  }

  private async toConsignment(consignment: ConsignmentEntity): Promise<Consignment> {
    const centre = await this.centreModel.findById(consignment.centreId).exec();
    return {
      id: consignment._id.toString(),
      code: consignment.code,
      centreId: consignment.centreId.toString(),
      centreName: centre?.name ?? 'Collection centre',
      riderName: consignment.riderName,
      riderPhone: consignment.riderPhone,
      status: consignment.status,
      testRequestIds: consignment.testRequestIds.map((id) => id.toString()),
      testRequestCount: consignment.testRequestIds.length,
      dispatchedAt: consignment.dispatchedAt?.toISOString() ?? null,
      receivedAt: consignment.receivedAt?.toISOString() ?? null,
      rejectedAt: consignment.rejectedAt?.toISOString() ?? null,
      rejectionReason: consignment.rejectionReason,
      notes: consignment.notes,
      createdAt: consignment.createdAt.toISOString(),
    };
  }

  private toCentre(centre: CollectionCentreEntity): CollectionCentre {
    return {
      id: centre._id.toString(),
      code: centre.code,
      name: centre.name,
      address: centre.address,
      phone: centre.phone,
      homeCollection: centre.homeCollection,
      active: centre.active,
    };
  }
}
