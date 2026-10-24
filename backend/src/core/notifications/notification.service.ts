import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import nodemailer, { type Transporter } from 'nodemailer';
import type {
  NotificationChannel,
  NotificationRecord,
  NotificationStatus,
  Paginated,
  Role,
} from '@lims/shared';
import { buildPaginated } from '../../common/utils/format';
import { currentActor } from '../../common/utils/actor';
import { NotificationModelName, type NotificationEntity } from './notification.schema';
import type { NotificationQueryDto } from './dto/notification.dto';

export interface NotificationRecipient {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export interface NotificationPayload {
  labId: string;
  type: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  recipient?: NotificationRecipient;
  caseId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  role?: Role | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  provider: string;
  messageId: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: Transporter | null = null;

  constructor(
    @InjectModel(NotificationModelName)
    private readonly notificationModel: Model<NotificationEntity>,
    private readonly config: ConfigService,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationRecord[]> {
    const channels: NotificationChannel[] =
      payload.channels && payload.channels.length > 0 ? payload.channels : ['IN_APP'];
    const records: NotificationRecord[] = [];

    if (channels.includes('IN_APP')) {
      records.push(await this.createInApp(payload));
    }

    for (const channel of channels.filter((item) => item !== 'IN_APP')) {
      const recipient = channel === 'EMAIL' ? payload.recipient?.email : payload.recipient?.phone;
      if (!recipient) {
        records.push(
          await this.createRecord(payload, channel, 'SKIPPED', recipient ?? null, {
            reason: `No ${channel.toLowerCase()} recipient configured.`,
          }),
        );
        continue;
      }
      const record = await this.createRecord(payload, channel, 'QUEUED', recipient);
      records.push(await this.deliver(record.id));
    }

    return records;
  }

  async listForUser(
    userId: string,
    role: Role | null,
    query: NotificationQueryDto,
  ): Promise<Paginated<NotificationRecord>> {
    const filter: Record<string, unknown> = {
      channel: 'IN_APP',
      $or: [{ userId: new Types.ObjectId(userId) }, ...(role ? [{ role }] : [])],
    };
    if (query.unreadOnly) filter.readAt = null;
    if (query.status) filter.status = query.status;
    return this.paginate(filter, query);
  }

  async outbox(query: NotificationQueryDto): Promise<Paginated<NotificationRecord>> {
    const filter: Record<string, unknown> = {};
    if (query.channel) filter.channel = query.channel;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { body: regex }, { recipient: regex }];
    }
    return this.paginate(filter, query);
  }

  async markRead(id: string, userId: string, role: Role | null): Promise<NotificationRecord> {
    const notification = await this.notificationModel
      .findOne({
        _id: id,
        channel: 'IN_APP',
        $or: [{ userId: new Types.ObjectId(userId) }, ...(role ? [{ role }] : [])],
      })
      .exec();
    if (!notification) throw new NotFoundException('Notification not found.');
    notification.readAt = new Date();
    await notification.save();
    return this.toDto(notification);
  }

  async markAllRead(userId: string, role: Role | null): Promise<{ updated: number }> {
    const result = await this.notificationModel
      .updateMany(
        {
          channel: 'IN_APP',
          readAt: null,
          $or: [{ userId: new Types.ObjectId(userId) }, ...(role ? [{ role }] : [])],
        },
        { $set: { readAt: new Date() } },
      )
      .exec();
    return { updated: result.modifiedCount };
  }

  async retry(id: string): Promise<NotificationRecord> {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.channel === 'IN_APP') {
      return this.toDto(notification);
    }
    notification.status = 'QUEUED';
    notification.lastError = null;
    await notification.save();
    return this.deliver(id);
  }

  async deliver(id: string): Promise<NotificationRecord> {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.channel === 'IN_APP' || notification.status === 'SENT') {
      return this.toDto(notification);
    }

    notification.status = 'SENDING';
    notification.attempts += 1;
    await notification.save();

    try {
      const result = await this.dispatch(notification);
      notification.status = 'SENT';
      notification.sentAt = new Date();
      notification.deliveredAt = new Date();
      notification.provider = result.provider;
      notification.providerMessageId = result.messageId;
      notification.lastError = null;
      await notification.save();
      return this.toDto(notification);
    } catch (error) {
      notification.status = 'FAILED';
      notification.lastError = error instanceof Error ? error.message : 'Delivery failed.';
      await notification.save();
      this.logger.warn(
        { err: error, channel: notification.channel, notificationId: id },
        'Notification delivery failed.',
      );
      return this.toDto(notification);
    }
  }

  private async createInApp(payload: NotificationPayload): Promise<NotificationRecord> {
    const doc = new this.notificationModel({
      channel: 'IN_APP',
      status: 'SENT',
      type: payload.type,
      title: payload.title,
      body: payload.body,
      userId: payload.userId ? new Types.ObjectId(payload.userId) : null,
      role: payload.role ?? null,
      entityType: payload.entityType ?? (payload.caseId ? 'Case' : null),
      entityId: payload.entityId ?? payload.caseId ?? null,
      caseId: payload.caseId ?? null,
      recipient: payload.userId ?? payload.role ?? null,
      provider: 'in-app',
      attempts: 1,
      sentAt: new Date(),
      metadata: { ...(payload.metadata ?? {}) },
    });
    await doc.save();
    return this.toDto(doc);
  }

  private async createRecord(
    payload: NotificationPayload,
    channel: NotificationChannel,
    status: NotificationStatus,
    recipient: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<NotificationRecord> {
    const doc = new this.notificationModel({
      channel,
      status,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      userId: payload.userId ? new Types.ObjectId(payload.userId) : null,
      role: payload.role ?? null,
      entityType: payload.entityType ?? (payload.caseId ? 'Case' : null),
      entityId: payload.entityId ?? payload.caseId ?? null,
      caseId: payload.caseId ?? null,
      recipient,
      attempts: 0,
      metadata: { ...(payload.metadata ?? {}), ...metadata },
    });
    await doc.save();
    return this.toDto(doc);
  }

  private async dispatch(notification: NotificationEntity): Promise<DeliveryResult> {
    const live = this.config.get<string>('NOTIFICATIONS_MODE') === 'live';
    if (!live) {
      return {
        provider: 'outbox',
        messageId: `outbox-${notification._id.toString()}`,
      };
    }
    switch (notification.channel) {
      case 'EMAIL':
        return this.sendEmail(notification);
      case 'SMS':
        return this.sendSms(notification);
      case 'WHATSAPP':
        return this.sendWhatsApp(notification);
      default:
        return { provider: 'in-app', messageId: notification._id.toString() };
    }
  }

  private async sendEmail(notification: NotificationEntity): Promise<DeliveryResult> {
    const provider = this.config.get<string>('EMAIL_PROVIDER');
    if (provider !== 'smtp' && provider !== 'resend') {
      return { provider: 'outbox', messageId: `outbox-${notification._id.toString()}` };
    }
    const isResend = provider === 'resend';
    const host = isResend ? 'smtp.resend.com' : this.config.get<string>('SMTP_HOST');
    const port = isResend
      ? (this.config.get<number>('SMTP_PORT') ?? 465)
      : (this.config.get<number>('SMTP_PORT') ?? 587);
    const secure = isResend
      ? (this.config.get<boolean>('SMTP_SECURE') ?? (port === 465))
      : (this.config.get<boolean>('SMTP_SECURE') ?? false);
    const user = isResend ? 'resend' : this.config.get<string>('SMTP_USER');
    const pass = isResend
      ? (this.config.get<string>('RESEND_API_KEY') ?? this.config.get<string>('SMTP_PASS'))
      : this.config.get<string>('SMTP_PASS');

    this.transporter ??= nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
    const result = await this.transporter.sendMail({
      from: this.config.get<string>('EMAIL_FROM'),
      to: notification.recipient ?? undefined,
      subject: notification.title,
      text: notification.body,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>${escapeHtml(
        notification.title,
      )}</h2><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(
        notification.body,
      )}</p><hr><p style="color:#777;font-size:12px">Histopathology LIMS</p></div>`,
    });
    return { provider: isResend ? 'resend' : 'smtp', messageId: result.messageId ?? null };
  }

  private async sendSms(notification: NotificationEntity): Promise<DeliveryResult> {
    const provider = this.config.get<string>('SMS_PROVIDER') ?? 'log';
    if (provider === 'termii') {
      const apiKey = this.config.get<string>('TERMII_API_KEY');
      if (!apiKey) throw new Error('TERMII_API_KEY is not configured.');
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: notification.recipient,
          from: this.config.get<string>('TERMII_SENDER_ID') ?? 'HISTOLIMS',
          sms: notification.body,
          type: 'plain',
          channel: 'generic',
          api_key: apiKey,
        }),
      });
      if (!response.ok) throw new Error(`Termii returned ${response.status}.`);
      const body = (await response.json()) as { message_id?: string; message?: string };
      return { provider: 'termii', messageId: body.message_id ?? null };
    }
    if (provider === 'twilio') {
      return this.sendTwilio(notification.recipient ?? '', notification.body, false);
    }
    return { provider: 'outbox', messageId: `outbox-${notification._id.toString()}` };
  }

  private async sendWhatsApp(notification: NotificationEntity): Promise<DeliveryResult> {
    return this.sendTwilio(notification.recipient ?? '', notification.body, true);
  }

  private async sendTwilio(to: string, body: string, whatsapp: boolean): Promise<DeliveryResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = whatsapp
      ? this.config.get<string>('TWILIO_WHATSAPP_FROM')
      : this.config.get<string>('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      throw new Error('Twilio credentials are incomplete.');
    }
    const form = new URLSearchParams({
      To: whatsapp ? `whatsapp:${to}` : to,
      From: whatsapp ? `whatsapp:${from}` : from,
      Body: body,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      },
    );
    if (!response.ok) throw new Error(`Twilio returned ${response.status}.`);
    const result = (await response.json()) as { sid?: string };
    return { provider: whatsapp ? 'twilio-whatsapp' : 'twilio-sms', messageId: result.sid ?? null };
  }

  private async paginate(
    filter: Record<string, unknown>,
    query: NotificationQueryDto,
  ): Promise<Paginated<NotificationRecord>> {
    const [documents, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      documents.map((document) => this.toDto(document)),
      total,
      query.page,
      query.limit,
    );
  }

  private toDto(doc: NotificationEntity): NotificationRecord {
    return {
      id: doc._id.toString(),
      channel: doc.channel as NotificationRecord['channel'],
      status: doc.status as NotificationRecord['status'],
      type: doc.type,
      title: doc.title,
      body: doc.body,
      recipient: doc.recipient ?? null,
      provider: doc.provider ?? null,
      attempts: doc.attempts ?? 0,
      lastError: doc.lastError ?? null,
      caseId: doc.caseId ?? null,
      entityType: doc.entityType ?? null,
      entityId: doc.entityId ?? null,
      readAt: doc.readAt ? doc.readAt.toISOString() : null,
      sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
      metadata: (doc.metadata ?? {}) as Record<string, unknown>,
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

void currentActor;
