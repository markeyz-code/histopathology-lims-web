import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WorklistQueryDto {
  @ApiPropertyOptional({ enum: ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'AMENDED'] })
  @IsOptional()
  @IsEnum(['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'AMENDED'])
  status?: 'RECEIVED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'AMENDED';

  @ApiPropertyOptional({ enum: ['ROUTINE', 'URGENT', 'FROZEN'] })
  @IsOptional()
  @IsEnum(['ROUTINE', 'URGENT', 'FROZEN'])
  priority?: 'ROUTINE' | 'URGENT' | 'FROZEN';

  @ApiPropertyOptional({ enum: ['me', 'unassigned', 'all'], default: 'all' })
  @IsOptional()
  @IsEnum(['me', 'unassigned', 'all'])
  assigned?: 'me' | 'unassigned' | 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subspecialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  pathologistId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
