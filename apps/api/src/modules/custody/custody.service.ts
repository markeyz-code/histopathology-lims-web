import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import type { CustodyEntityType, Station } from '@lims/shared';
import type { Actor } from '../../common/utils/actor';
import { CustodyEventModelName, type CustodyEventEntity } from './custody-event.schema';
import { toCustodyEvent } from '../../common/serializers/entities';
import type { CustodyEvent as CustodyEventDto } from '@lims/shared';

export interface AppendCustodyEventInput {
  entityType: CustodyEntityType;
  entityId: Types.ObjectId;
  caseId: Types.ObjectId | null;
  eventType: string;
  station: Station | null;
  fromState: string | null;
  toState: string;
  reason?: string | null;
  barcode?: string | null;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

@Injectable()
export class CustodyService {
  constructor(
    @InjectModel(CustodyEventModelName)
    private readonly eventModel: Model<CustodyEventEntity>,
  ) {}

  async append(
    input: AppendCustodyEventInput,
    actor: Actor,
    session: ClientSession,
  ): Promise<CustodyEventEntity> {
    if (!actor.userId) {
      throw new Error('Custody events require an authenticated actor.');
    }
    const event = new this.eventModel({
      entityType: input.entityType,
      entityId: input.entityId,
      caseId: input.caseId,
      eventType: input.eventType,
      station: input.station,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason ?? null,
      userId: new Types.ObjectId(actor.userId),
      userName: actor.userName,
      userRole: actor.userRole,
      timestamp: input.timestamp ?? new Date(),
      barcode: input.barcode ?? null,
      metadata: input.metadata ?? {},
    });
    await event.save({ session });
    return event;
  }

  async forEntity(
    entityType: CustodyEntityType,
    entityId: string,
    limit = 500,
  ): Promise<CustodyEventDto[]> {
    const events = await this.eventModel
      .find({ entityType, entityId: new Types.ObjectId(entityId) })
      .sort({ timestamp: 1, _id: 1 })
      .limit(limit)
      .exec();
    return events.map((event) => toCustodyEvent(event));
  }

  async forCase(caseId: string, limit = 2_000): Promise<CustodyEventDto[]> {
    const events = await this.eventModel
      .find({ caseId: new Types.ObjectId(caseId) })
      .sort({ timestamp: 1, _id: 1 })
      .limit(limit)
      .exec();
    return events.map((event) => toCustodyEvent(event));
  }

  async latestForEntity(entityType: CustodyEntityType, entityId: string): Promise<CustodyEventDto> {
    const event = await this.eventModel
      .findOne({ entityType, entityId: new Types.ObjectId(entityId) })
      .sort({ timestamp: -1, _id: -1 })
      .exec();
    if (!event) throw new NotFoundException('No custody history for this item.');
    return toCustodyEvent(event);
  }
}
