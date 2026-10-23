import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STATIONS, type Station } from '@lims/shared';

export class ScanDto {
  @ApiProperty({ example: 'BL-01J8Z9K3QW' })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  barcode!: string;

  @ApiProperty({ enum: STATIONS, example: 'PROCESSING' })
  @IsEnum(STATIONS)
  station!: Station;

  @ApiPropertyOptional({ enum: ['REJECTED', 'RECUT_REQUESTED'] })
  @IsOptional()
  @IsIn(['REJECTED', 'RECUT_REQUESTED'])
  eventType?: 'REJECTED' | 'RECUT_REQUESTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
