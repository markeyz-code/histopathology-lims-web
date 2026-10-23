import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  ClaimQueryDto,
  CreateInvoiceDto,
  InitializePaymentDto,
  InvoiceQueryDto,
  ManualPaymentDto,
  PaymentEventDto,
} from './dto/billing.dto';
import { BillingService } from './billing.service';

const BILLING_ROLES = ['SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST'] as const;

@ApiTags('Billing')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('invoices')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'Create an invoice for a case (self-pay, HMO or corporate)' })
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.create(dto, user);
  }

  @Get('invoices')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'List invoices with payer and status filters' })
  invoices(@Query() query: InvoiceQueryDto) {
    return this.billing.list(query);
  }

  @Get('invoices/case/:caseId')
  @Roles(...BILLING_ROLES, 'PATHOLOGIST')
  @ApiOperation({ summary: 'Invoices belonging to one case' })
  caseInvoices(@Param('caseId', ParseObjectIdPipe) caseId: string) {
    return this.billing.forCase(caseId);
  }

  @Get('invoices/:id/payments')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'Payment attempts for an invoice' })
  payments(@Param('id', ParseObjectIdPipe) id: string) {
    return this.billing.listPayments(id);
  }

  @Post('invoices/:id/payments/initialize')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'Create a Paystack or Flutterwave checkout for the balance' })
  initialize(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: InitializePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.initializePayment(id, dto, user);
  }

  @Post('invoices/:id/payments/manual')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'Record cash, transfer or HMO payment' })
  manual(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ManualPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.manualPayment(id, dto, user);
  }

  @Public()
  @Get('payments/:reference')
  @ApiOperation({ summary: 'Public payment status used by the checkout callback page' })
  payment(@Param('reference') reference: string) {
    return this.billing.getPayment(reference);
  }

  @Public()
  @Post('payments/mock/:reference/complete')
  @ApiOperation({ summary: 'Complete a mock-mode payment (local demonstrations only)' })
  mockComplete(@Param('reference') reference: string) {
    return this.billing.completeMock(reference);
  }

  @Public()
  @Post('payments/webhooks/paystack')
  @ApiOperation({ summary: 'Paystack webhook (HMAC SHA-512 verified)' })
  async paystack(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() body: PaymentEventDto,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    return this.billing.paystackWebhook(raw, signature, body as unknown as Record<string, unknown>);
  }

  @Public()
  @Post('payments/webhooks/flutterwave')
  @ApiOperation({ summary: 'Flutterwave webhook (verif-hash verified)' })
  flutterwave(@Headers('verif-hash') signature: string | undefined, @Body() body: PaymentEventDto) {
    return this.billing.flutterwaveWebhook(signature, body as unknown as Record<string, unknown>);
  }

  @Get('claims/export')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'HMO claims export as CSV or JSON' })
  async claims(
    @Query() query: ClaimQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string | { rows: unknown[] }> {
    const result = await this.billing.exportClaims(query);
    if (query.format === 'json') return { rows: result.rows };
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hmo-claims-${query.from}-to-${query.to}.csv"`,
    });
    return result.csv;
  }
}
