import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_BLOCK_COUNT } from '@lims/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class GrossBlockDto {
  @ApiProperty()
  @IsMongoId()
  specimenId!: string;

  @ApiProperty({ example: 'Received in formalin: three cores of tan tissue...' })
  @IsString()
  @MinLength(5)
  @MaxLength(10_000)
  grossDescription!: string;

  @ApiProperty({ example: 3, maximum: MAX_BLOCK_COUNT })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BLOCK_COUNT)
  blockCount!: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BLOCK_COUNT)
  @IsString({ each: true })
  @MaxLength(2_000, { each: true })
  blockDescriptions?: string[];
}

export class BlockListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  specimenId?: string;
}
