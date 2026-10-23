import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  REAGENT_CATEGORIES,
  STAIN_QC_RESULTS,
  STAIN_RUN_STATUSES,
  STAIN_TYPES,
  type ReagentCategory,
  type StainQcResult,
  type StainRunStatus,
  type StainType,
} from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateReagentLotDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: REAGENT_CATEGORIES })
  @IsEnum(REAGENT_CATEGORIES)
  category!: ReagentCategory;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  vendor!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  catalogNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lotNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storageLocation?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 'mL' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit!: string;

  @ApiProperty()
  @IsISO8601()
  receivedAt!: string;

  @ApiProperty()
  @IsISO8601()
  expiresAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  openedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class UpdateReagentLotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storageLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  openedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class ValidateLotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdjustLotDto {
  @ApiProperty({ example: -2.5, description: 'Positive or negative quantity change' })
  @Type(() => Number)
  @IsNumber()
  delta!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReagentLotQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: REAGENT_CATEGORIES })
  @IsOptional()
  @IsEnum(REAGENT_CATEGORIES)
  category?: ReagentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['QUARANTINED', 'ACTIVE', 'EXPIRED', 'DEPLETED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  expiringWithinDays?: number;
}

export class StainRunLotDto {
  @ApiProperty()
  @IsMongoId()
  lotId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityUsed!: number;
}

export class CreateStainRunDto {
  @ApiProperty()
  @IsMongoId()
  caseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  slideId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  blockId?: string;

  @ApiProperty({ enum: STAIN_TYPES })
  @IsEnum(STAIN_TYPES)
  stainType!: StainType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  stainName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  equipment?: string;

  @ApiProperty({ type: [StainRunLotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StainRunLotDto)
  lots!: StainRunLotDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class CompleteStainRunDto {
  @ApiProperty({ enum: STAIN_QC_RESULTS })
  @IsEnum(STAIN_QC_RESULTS)
  qcResult!: StainQcResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class StainRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @ApiPropertyOptional({ enum: STAIN_RUN_STATUSES })
  @IsOptional()
  @IsEnum(STAIN_RUN_STATUSES)
  status?: StainRunStatus;
}

void IsBoolean;
