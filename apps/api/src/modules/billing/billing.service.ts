import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ClaimRow, Invoice, Paginated, Payment } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { runWithSystemTenant, runWithTenant } from '../../common/context/tenant-context';
import { buildPaginated } from '../../common/utils/format';
import { makeBarcode } from '../../common/utils/crypto';
import { withTransaction } from '../../common/utils/transaction';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabsService } from '../labs/labs.service';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { InvoiceModelName, type InvoiceEntity } from './invoice.schema';
import { PaymentModelName, type PaymentEntity } from './payment.schema';
import type {
  ClaimQueryDto,
  CreateInvoiceDto,
  InitializePaymentDto,
  InvoiceQueryDto,
  ManualPaymentDto,
} from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(InvoiceModelName) private readonly invoiceModel: Model<InvoiceEntity>,
    @InjectModel(PaymentModelName) private readonly paymentModel: Model<PaymentEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    private readonly labs: LabsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateInvoiceDto, user: AuthenticatedUser): Promise<Invoice> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    if (dto.payerType === 'HMO' && !dto.hmoName?.trim()) {
      throw new BadRequestException('HMO name is required for an HMO invoice.');
    }
    const items = dto.items.map((item) => {
      const total = round(item.quantity * item.unitPrice);
      return {
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: round(item.unitPrice),
        total,
        category: item.category?.trim() || 'PROFESSIONAL',
      };
    });
    const subtotal = round(items.reduce((sum, item) => sum + item.total, 0));
    const discount = round(dto.discount ?? 0);
    if (discount > subtotal) throw new BadRequestException('Discount cannot exceed the subtotal.');
    const total = round(subtotal - discount);

    return withTransaction(this.connection, async (session) => {
      const year = new Date().getUTCFullYear();
      const sequence = await this.labs.nextSequence(user.labId, `invoice-${year}`, session);
      const number = `INV-${year}-${String(sequence).padStart(6, '0')}`;
      const now = new Date();
      const invoice = new this.invoiceModel({
        number,
        caseId: caseDoc._id,
        patientId: caseDoc.patientId,
        payerType: dto.payerType,
        hmoName: dto.hmoName?.trim() || null,
        hmoCode: dto.hmoCode?.trim() || null,
        authorizationNumber: dto.authorizationNumber?.trim() || null,
        status: 'ISSUED',
        currency: (dto.currency ?? 'NGN').toUpperCase(),
        items,
        subtotal,
        discount,
        total,
        amountPaid: 0,
        balance: total,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : new Date(now.getTime() + 14 * 86_400_000),
        issuedAt: now,
        notes: dto.notes?.trim() || null,
        createdBy: new Types.ObjectId(user.id),
      });
      await invoice.save({ session });
      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'Invoice',
          entityId: invoice._id.toString(),
          caseId: caseDoc._id.toString(),
          after: { number, total, payerType: invoice.payerType },
          metadata: { hmoName: invoice.hmoName },
        },
        session,
      );
      return this.toInvoice(invoice, caseDoc);
    });
  }

  async list(query: InvoiceQueryDto): Promise<Paginated<Invoice>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.payerType) filter.payerType = query.payerType;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) range.$lte = new Date(`${query.to}T23:59:59.999Z`);
      filter.issuedAt = range;
    }
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ number: regex }, { hmoName: regex }, { authorizationNumber: regex }];
    }
    const [invoices, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);
    const items = await Promise.all(invoices.map((invoice) => this.toInvoice(invoice)));
    return buildPaginated(items, total, query.page, query.limit);
  }

  async forCase(caseId: string): Promise<Invoice[]> {
    const invoices = await this.invoiceModel.find({ caseId }).sort({ createdAt: -1 }).exec();
    return Promise.all(invoices.map((invoice) => this.toInvoice(invoice)));
  }

  async initializePayment(
    invoiceId: string,
    dto: InitializePaymentDto,
    user: AuthenticatedUser,
  ): Promise<Payment> {
    if (dto.provider !== 'PAYSTACK' && dto.provider !== 'FLUTTERWAVE') {
      throw new BadRequestException('Use the manual payment endpoint for cash, transfer or HMO.');
    }
    const invoice = await this.invoiceModel.findById(invoiceId).exec();
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      throw new ConflictException('This invoice cannot accept a payment.');
    }
    const amount = round(dto.amount ?? invoice.balance);
    if (amount <= 0 || amount > invoice.balance) {
      throw new BadRequestException('Payment amount must be within the outstanding balance.');
    }
    const patient = await this.patientModel.findById(invoice.patientId).exec();
    const reference = makeBarcode('PAY');
    const mode = this.config.get<string>('PAYMENTS_MODE') ?? 'mock';
    let checkoutUrl: string;
    let providerReference: string | null = null;
    let metadata: Record<string, unknown> = { mode };

    if (mode === 'mock') {
      checkoutUrl = `${this.config.get<string>('PUBLIC_WEB_URL')}/payments/mock?reference=${encodeURIComponent(reference)}`;
    } else if (dto.provider === 'PAYSTACK') {
      const result = await this.paystackInitialize(invoice, amount, reference, patient);
      checkoutUrl = result.authorizationUrl;
      providerReference = result.reference;
      metadata = { ...metadata, providerResponse: result.raw };
    } else {
      const result = await this.flutterwaveInitialize(invoice, amount, reference, patient);
      checkoutUrl = result.link;
      providerReference = result.reference;
      metadata = { ...metadata, providerResponse: result.raw };
    }

    const payment = new this.paymentModel({
      invoiceId: invoice._id,
      provider: dto.provider,
      status: 'PENDING',
      amount,
      currency: invoice.currency,
      reference,
      providerReference,
      checkoutUrl,
      metadata,
      createdBy: new Types.ObjectId(user.id),
    });
    await payment.save();
    await this.audit.record({
      action: 'PAYMENT',
      entityType: 'Invoice',
      entityId: invoice._id.toString(),
      caseId: invoice.caseId.toString(),
      after: { event: 'initialized', reference, amount, provider: dto.provider },
    });
    return this.toPayment(payment);
  }

  async manualPayment(
    invoiceId: string,
    dto: ManualPaymentDto,
    user: AuthenticatedUser,
  ): Promise<Payment> {
    return withTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findById(invoiceId).session(session).exec();
      if (!invoice) throw new NotFoundException('Invoice not found.');
      if (invoice.status === 'PAID' || invoice.status === 'VOID') {
        throw new ConflictException('This invoice cannot accept a payment.');
      }
      if (dto.amount > invoice.balance) {
        throw new BadRequestException('Payment exceeds the outstanding balance.');
      }
      const reference = makeBarcode('PAY');
      const payment = new this.paymentModel({
        invoiceId: invoice._id,
        provider: dto.provider,
        status: 'SUCCESS',
        amount: round(dto.amount),
        currency: invoice.currency,
        reference,
        providerReference: dto.reference.trim(),
        checkoutUrl: null,
        paidAt: new Date(),
        metadata: { note: dto.note ?? null, recordedBy: user.email },
        createdBy: new Types.ObjectId(user.id),
      });
      await payment.save({ session });
      await this.allocate(invoice._id.toString(), round(dto.amount), reference, session);
      return this.toPayment(payment);
    });
  }

  async listPayments(invoiceId: string): Promise<Payment[]> {
    const payments = await this.paymentModel.find({ invoiceId }).sort({ createdAt: -1 }).exec();
    return payments.map((payment) => this.toPayment(payment));
  }

  async getPayment(reference: string) {
    const located = await this.locatePayment(reference);
    return runWithTenant({ labId: located.labId }, async () => {
      const invoice = await this.invoiceModel.findById(located.payment.invoiceId).exec();
      return {
        reference: located.payment.reference,
        status: located.payment.status,
        amount: located.payment.amount,
        currency: located.payment.currency,
        checkoutUrl: located.payment.checkoutUrl,
        invoiceNumber: invoice?.number ?? null,
        balance: invoice?.balance ?? null,
      };
    });
  }

  async completeMock(reference: string) {
    if ((this.config.get<string>('PAYMENTS_MODE') ?? 'mock') !== 'mock') {
      throw new ForbiddenException('Mock payments are disabled.');
    }
    const located = await this.locatePayment(reference);
    await runWithTenant({ labId: located.labId }, () =>
      this.markSuccess(reference, located.payment.amount, located.payment.reference, 'mock'),
    );
    return this.getPayment(reference);
  }

  async paystackWebhook(
    rawBody: string,
    signature: string | undefined,
    event: Record<string, unknown>,
  ): Promise<{ received: true }> {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) throw new ForbiddenException('Paystack webhooks are not configured.');
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    if (!signature || !safeEqual(signature, expected)) {
      throw new ForbiddenException('Invalid Paystack signature.');
    }
    const data = asRecord(event.data);
    if (event.event === 'charge.success' && typeof data.reference === 'string') {
      const amount = Number(data.amount) / 100;
      const located = await this.locatePayment(data.reference);
      await runWithTenant({ labId: located.labId }, () =>
        this.markSuccess(
          data.reference as string,
          amount,
          String(data.id ?? data.reference),
          'paystack',
        ),
      );
    }
    return { received: true };
  }

  async flutterwaveWebhook(
    signature: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<{ received: true }> {
    const hash = this.config.get<string>('FLUTTERWAVE_WEBHOOK_HASH');
    if (!hash) throw new ForbiddenException('Flutterwave webhooks are not configured.');
    if (!signature || !safeEqual(signature, hash)) {
      throw new ForbiddenException('Invalid Flutterwave webhook hash.');
    }
    const data = asRecord(payload.data);
    if (String(payload.event ?? payload['event.type'] ?? '').includes('charge') || data.tx_ref) {
      if (
        typeof data.tx_ref === 'string' &&
        ['successful', 'success'].includes(String(data.status))
      ) {
        const located = await this.locatePayment(data.tx_ref);
        await runWithTenant({ labId: located.labId }, () =>
          this.markSuccess(
            data.tx_ref as string,
            Number(data.amount),
            String(data.id ?? data.tx_ref),
            'flutterwave',
          ),
        );
      }
    }
    return { received: true };
  }

  async exportClaims(query: ClaimQueryDto): Promise<{ rows: ClaimRow[]; csv: string }> {
    const filter: Record<string, unknown> = {
      issuedAt: {
        $gte: new Date(`${query.from}T00:00:00.000Z`),
        $lte: new Date(`${query.to}T23:59:59.999Z`),
      },
      payerType: 'HMO',
    };
    if (query.hmoName) filter.hmoName = new RegExp(query.hmoName, 'i');
    const invoices = await this.invoiceModel.find(filter).sort({ issuedAt: 1 }).exec();
    const rows: ClaimRow[] = [];
    for (const invoice of invoices) {
      const [caseDoc, patient] = await Promise.all([
        this.caseModel.findById(invoice.caseId).exec(),
        this.patientModel.findById(invoice.patientId).exec(),
      ]);
      if (!caseDoc || !patient) continue;
      rows.push({
        invoiceNumber: invoice.number,
        accessionNumber: caseDoc.accessionNumber,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hmoName: invoice.hmoName,
        authorizationNumber: invoice.authorizationNumber,
        serviceDate: (invoice.issuedAt ?? invoice.createdAt).toISOString().slice(0, 10),
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        status: invoice.status,
      });
    }
    return { rows, csv: toCsv(rows) };
  }

  private async locatePayment(reference: string): Promise<{
    payment: PaymentEntity;
    labId: string;
  }> {
    return runWithSystemTenant('payment-reference', '', async () => {
      const payment = await this.paymentModel.findOne({ reference }).exec();
      if (!payment) throw new NotFoundException('Payment not found.');
      return { payment, labId: payment.labId.toString() };
    });
  }

  private async markSuccess(
    reference: string,
    amount: number,
    providerReference: string,
    provider: string,
  ): Promise<void> {
    await withTransaction(this.connection, async (session) => {
      const payment = await this.paymentModel.findOne({ reference }).session(session).exec();
      if (!payment) throw new NotFoundException('Payment not found.');
      if (payment.status === 'SUCCESS') return;
      if (Math.abs(payment.amount - amount) > 0.05) {
        throw new ConflictException('Payment amount does not match the initialized amount.');
      }
      payment.status = 'SUCCESS';
      payment.providerReference = providerReference;
      payment.paidAt = new Date();
      payment.metadata = { ...payment.metadata, webhookProvider: provider };
      await payment.save({ session });
      await this.allocate(payment.invoiceId.toString(), payment.amount, payment.reference, session);
      await this.audit.record(
        {
          action: 'PAYMENT',
          entityType: 'Invoice',
          entityId: payment.invoiceId.toString(),
          after: { event: 'paid', reference, amount, provider },
        },
        session,
      );
    });
  }

  private async allocate(
    invoiceId: string,
    amount: number,
    reference: string,
    session?: import('mongoose').ClientSession,
  ): Promise<void> {
    let query = this.invoiceModel.findById(invoiceId);
    if (session) query = query.session(session);
    const invoice = await query.exec();
    if (!invoice) throw new NotFoundException('Invoice not found.');
    invoice.amountPaid = round(invoice.amountPaid + amount);
    invoice.balance = round(Math.max(invoice.total - invoice.amountPaid, 0));
    invoice.status = invoice.balance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    invoice.paidAt = invoice.balance <= 0 ? new Date() : invoice.paidAt;
    await invoice.save({ session });
    await this.audit.record(
      {
        action: 'PAYMENT',
        entityType: 'Invoice',
        entityId: invoice._id.toString(),
        caseId: invoice.caseId.toString(),
        after: { amountPaid: invoice.amountPaid, balance: invoice.balance, status: invoice.status },
        metadata: { reference },
      },
      session,
    );
  }

  private async paystackInitialize(
    invoice: InvoiceEntity,
    amount: number,
    reference: string,
    patient: PatientEntity | null,
  ): Promise<{ authorizationUrl: string; reference: string; raw: unknown }> {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) throw new BadGatewayException('Paystack is not configured.');
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:
          patient?.email ?? this.config.get<string>('EMAIL_FROM') ?? 'billing@histopathology.local',
        amount: Math.round(amount * 100),
        currency: invoice.currency,
        reference,
        callback_url: `${this.config.get<string>('PUBLIC_WEB_URL')}/payments/callback?reference=${encodeURIComponent(reference)}`,
        metadata: { invoiceId: invoice._id.toString(), invoiceNumber: invoice.number },
      }),
    });
    if (!response.ok) throw new BadGatewayException(`Paystack returned ${response.status}.`);
    const body = (await response.json()) as {
      status: boolean;
      data?: { authorization_url?: string; reference?: string };
      message?: string;
    };
    if (!body.status || !body.data?.authorization_url) {
      throw new BadGatewayException(body.message ?? 'Paystack did not return a checkout URL.');
    }
    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference ?? reference,
      raw: body,
    };
  }

  private async flutterwaveInitialize(
    invoice: InvoiceEntity,
    amount: number,
    reference: string,
    patient: PatientEntity | null,
  ): Promise<{ link: string; reference: string; raw: unknown }> {
    const secret = this.config.get<string>('FLUTTERWAVE_SECRET_KEY');
    if (!secret) throw new BadGatewayException('Flutterwave is not configured.');
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency: invoice.currency,
        redirect_url: `${this.config.get<string>('PUBLIC_WEB_URL')}/payments/callback?reference=${encodeURIComponent(reference)}`,
        customer: {
          email:
            patient?.email ??
            this.config.get<string>('EMAIL_FROM') ??
            'billing@histopathology.local',
          name: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient',
        },
        customizations: {
          title: 'Histopathology LIMS',
          description: `Invoice ${invoice.number}`,
        },
      }),
    });
    if (!response.ok) throw new BadGatewayException(`Flutterwave returned ${response.status}.`);
    const body = (await response.json()) as {
      status: string;
      data?: { link?: string };
      message?: string;
    };
    if (body.status !== 'success' || !body.data?.link) {
      throw new BadGatewayException(body.message ?? 'Flutterwave did not return a checkout URL.');
    }
    return { link: body.data.link, reference, raw: body };
  }

  private async toInvoice(invoice: InvoiceEntity, knownCase?: CaseEntity): Promise<Invoice> {
    const [caseDoc, patient] = await Promise.all([
      knownCase ?? this.caseModel.findById(invoice.caseId).exec(),
      this.patientModel.findById(invoice.patientId).exec(),
    ]);
    return {
      id: invoice._id.toString(),
      number: invoice.number,
      caseId: invoice.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : '—',
      payerType: invoice.payerType,
      hmoName: invoice.hmoName,
      hmoCode: invoice.hmoCode,
      authorizationNumber: invoice.authorizationNumber,
      status: invoice.status,
      currency: invoice.currency,
      items: invoice.items.map((item, index) => ({
        id: `${invoice._id.toString()}-${index}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        category: item.category,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
      issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  private toPayment(payment: PaymentEntity): Payment {
    return {
      id: payment._id.toString(),
      invoiceId: payment.invoiceId.toString(),
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      providerReference: payment.providerReference,
      checkoutUrl: payment.checkoutUrl,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function toCsv(rows: ClaimRow[]): string {
  const header = [
    'invoice_number',
    'accession_number',
    'patient_name',
    'hmo_name',
    'authorization_number',
    'service_date',
    'total',
    'amount_paid',
    'balance',
    'status',
  ];
  const lines = rows.map((row) =>
    [
      row.invoiceNumber,
      row.accessionNumber,
      row.patientName,
      row.hmoName ?? '',
      row.authorizationNumber ?? '',
      row.serviceDate,
      row.total.toFixed(2),
      row.amountPaid.toFixed(2),
      row.balance.toFixed(2),
      row.status,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

function csvCell(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
