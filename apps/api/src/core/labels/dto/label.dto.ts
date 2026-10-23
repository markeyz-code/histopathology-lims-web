import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  LABEL_FORMATS,
  LABEL_SYMBOLOGIES,
  type LabelFormat,
  type LabelSymbology,
} from '@lims/shared';

export const LABEL_INCLUDES = ['all', 'specimens', 'blocks', 'slides'] as const;
export type LabelInclude = (typeof LABEL_INCLUDES)[number];

export class LabelQueryDto {
  @ApiPropertyOptional({ enum: LABEL_FORMATS, default: 'pdf' })
  @IsOptional()
  @IsEnum(LABEL_FORMATS)
  format?: LabelFormat;

  @ApiPropertyOptional({ enum: LABEL_SYMBOLOGIES, default: 'datamatrix' })
  @IsOptional()
  @IsEnum(LABEL_SYMBOLOGIES)
  symbology?: LabelSymbology;
}

export class CaseLabelQueryDto extends LabelQueryDto {
  @ApiPropertyOptional({ enum: LABEL_INCLUDES, default: 'all' })
  @IsOptional()
  @IsEnum(LABEL_INCLUDES)
  include?: LabelInclude;
}
