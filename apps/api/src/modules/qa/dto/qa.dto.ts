import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  QA_DISCREPANCY_CODES,
  QA_REVIEW_STATUSES,
  QA_REVIEW_TYPES,
  QA_SEVERITIES,
  type QaDiscrepancyCode,
  type QaReviewStatus,
  type QaReviewType,
  type QaSeverity,
} from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateQaReviewDto {
  @ApiProperty()
  @IsMongoId()
  caseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  reportId?: string;

  @ApiProperty({ enum: QA_REVIEW_TYPES })
  @IsEnum(QA_REVIEW_TYPES)
  type!: QaReviewType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  reviewerId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1_000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

export class AssignQaReviewDto {
  @ApiProperty()
  @IsMongoId()
  reviewerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

export class StartQaReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  findings?: string;
}

export class CompleteQaReviewDto {
  @ApiProperty({ enum: ['AGREED', 'DISCREPANT'] })
  @IsEnum(['AGREED', 'DISCREPANT'])
  outcome!: 'AGREED' | 'DISCREPANT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  reviewDiagnosis?: string;

  @ApiPropertyOptional({ enum: QA_DISCREPANCY_CODES })
  @IsOptional()
  @IsEnum(QA_DISCREPANCY_CODES)
  disagreementCode?: QaDiscrepancyCode;

  @ApiPropertyOptional({ enum: QA_SEVERITIES })
  @IsOptional()
  @IsEnum(QA_SEVERITIES)
  severity?: QaSeverity;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(5_000)
  findings!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  actionPlan?: string;
}

export class QaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: QA_REVIEW_STATUSES })
  @IsOptional()
  @IsEnum(QA_REVIEW_STATUSES)
  status?: QaReviewStatus;

  @ApiPropertyOptional({ enum: QA_REVIEW_TYPES })
  @IsOptional()
  @IsEnum(QA_REVIEW_TYPES)
  type?: QaReviewType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  reviewerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  mine?: boolean;
}

void Type;
