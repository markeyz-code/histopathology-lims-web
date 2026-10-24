import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateReportDto {
  @ApiProperty()
  @IsMongoId()
  protocolId!: string;
}

export class CodingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  snomedCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  snomedDisplay?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icdo3MorphologyCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  icdo3MorphologyDisplay?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icdo3TopographyCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  icdo3TopographyDisplay?: string | null;
}

export class UpdateReportDto {
  @ApiProperty({ type: Object, description: 'Field key → value map for the protocol' })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ type: CodingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodingDto)
  coding?: CodingDto;
}

export class ReleaseReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AmendReportDto {
  @ApiProperty({ example: 'Corrected HER2 score after repeat ISH.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  reason!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ type: CodingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodingDto)
  coding?: CodingDto;
}
