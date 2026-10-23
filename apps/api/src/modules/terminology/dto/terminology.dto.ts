import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CODING_SYSTEMS, type CodingSystem } from '@lims/shared';

export class TerminologyQueryDto {
  @ApiPropertyOptional({ enum: CODING_SYSTEMS })
  @IsOptional()
  @IsEnum(CODING_SYSTEMS)
  system?: CodingSystem;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class TerminologyCodeDto {
  @ApiProperty({ enum: CODING_SYSTEMS })
  @IsEnum(CODING_SYSTEMS)
  system!: CodingSystem;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  display!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  synonyms?: string[];
}

export class ImportTerminologyDto {
  @ApiProperty({ type: [TerminologyCodeDto] })
  @IsArray()
  @ArrayMaxSize(2_000)
  @ValidateNested({ each: true })
  @Type(() => TerminologyCodeDto)
  codes!: TerminologyCodeDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
