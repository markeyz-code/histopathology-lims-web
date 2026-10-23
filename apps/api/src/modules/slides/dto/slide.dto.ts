import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  MinLength,
} from 'class-validator';
import { MAX_SLIDE_COUNT, STAIN_TYPES, type StainType } from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CutSlidesDto {
  @ApiProperty()
  @IsMongoId()
  blockId!: string;

  @ApiProperty({ example: 2, maximum: MAX_SLIDE_COUNT })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SLIDE_COUNT)
  count!: number;

  @ApiPropertyOptional({ enum: STAIN_TYPES, default: 'H_AND_E' })
  @IsOptional()
  @IsEnum(STAIN_TYPES)
  stainType?: StainType;

  @ApiPropertyOptional({ example: 'Cytokeratin 7' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  specialStain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class StainRequestDto {
  @ApiProperty()
  @IsMongoId()
  blockId!: string;

  @ApiProperty({ enum: ['SPECIAL', 'IMMUNOHISTOCHEMISTRY'] })
  @IsEnum(['SPECIAL', 'IMMUNOHISTOCHEMISTRY'])
  stainType!: 'SPECIAL' | 'IMMUNOHISTOCHEMISTRY';

  @ApiProperty({ example: 'CK20' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  specialStain!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1_000)
  reason!: string;
}

export class RecutRequestDto {
  @ApiProperty({ example: 'Section is folded; recut at 3 microns.' })
  @IsString()
  @MinLength(5)
  @MaxLength(1_000)
  reason!: string;
}

export class SlideListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  blockId?: string;
}
