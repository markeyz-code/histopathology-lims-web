import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WSI_STATUSES, type WsiStatus } from '@lims/shared';

export class LinkWsiDto {
  @ApiProperty({ example: 'https://wsi.example.org/scans/SL-01J8Z9.tif' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  url!: string;

  @ApiPropertyOptional({ example: 'https://viewer.example.org/slide/SL-01J8Z9' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  viewerUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  scanner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  magnification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  notes?: string;
}

export class WsiWebhookDto {
  @ApiPropertyOptional({ example: 'HISTO' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  labCode?: string;

  @ApiProperty({ example: 'SL-HP-2026-000023-A1-1' })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  barcode!: string;

  @ApiProperty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  url!: string;

  @ApiPropertyOptional({ enum: WSI_STATUSES })
  @IsOptional()
  @IsEnum(WSI_STATUSES)
  status?: WsiStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  scanner?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
