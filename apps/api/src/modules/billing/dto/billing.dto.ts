import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  INVOICE_STATUSES,
  PAYER_TYPES,
  PAYMENT_PROVIDERS,
  type InvoiceStatus,
  type PayerType,
  type PaymentProvider,
} from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsMongoId()
  caseId!: string;

  @ApiProperty({ enum: PAYER_TYPES })
  @IsEnum(PAYER_TYPES)
  payerType!: PayerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hmoName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hmoCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  authorizationNumber?: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional()
  @IsEnum(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: PAYER_TYPES })
  @IsOptional()
  @IsEnum(PAYER_TYPES)
  payerType?: PayerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class InitializePaymentDto {
  @ApiProperty({ enum: PAYMENT_PROVIDERS })
  @IsEnum(PAYMENT_PROVIDERS)
  provider!: PaymentProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number;
}

export class ManualPaymentDto {
  @ApiProperty({ enum: ['CASH', 'TRANSFER', 'HMO'] })
  @IsEnum(['CASH', 'TRANSFER', 'HMO'])
  provider!: 'CASH' | 'TRANSFER' | 'HMO';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  reference!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ClaimQueryDto {
  @ApiProperty()
  @IsISO8601()
  from!: string;

  @ApiProperty()
  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({ enum: ['csv', 'json'] })
  @IsOptional()
  @IsEnum(['csv', 'json'])
  format?: 'csv' | 'json';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hmoName?: string;
}

export class PaymentEventDto {
  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;
}

void Max;
