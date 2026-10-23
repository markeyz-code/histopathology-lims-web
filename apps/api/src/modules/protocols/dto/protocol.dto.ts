import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProtocolDto {
  @ApiProperty({ example: 'breast_carcinoma' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'key must be lower_snake_case.' })
  key!: string;

  @ApiProperty({ example: 'Breast carcinoma synoptic report' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Invasive breast carcinoma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  cancerType!: string;

  @ApiProperty({ example: 'Breast' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  subspecialty!: string;

  @ApiProperty({ type: Object, description: 'ProtocolContent: sections and fields' })
  @IsObject()
  @IsNotEmptyObject()
  content!: Record<string, unknown>;
}

export class UpdateProtocolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  cancerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  subspecialty?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ProtocolListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subspecialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  @IsBoolean()
  active?: boolean;
}
