import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SEXES, type Sex } from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class NextOfKinDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string;
}

export class CreatePatientDto {
  @ApiPropertyOptional({ description: 'Leave blank to auto-generate an MRN.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mrn?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ enum: SEXES })
  @IsEnum(SEXES)
  sex!: Sex;

  @ApiPropertyOptional({ example: '1979-04-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD.' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 46 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nationalId?: string;

  @ApiPropertyOptional({ type: NextOfKinDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NextOfKinDto)
  nextOfKin?: NextOfKinDto;
}

export class UpdatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ enum: SEXES })
  @IsOptional()
  @IsEnum(SEXES)
  sex?: Sex;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nationalId?: string;

  @ApiPropertyOptional({ type: NextOfKinDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NextOfKinDto)
  nextOfKin?: NextOfKinDto;
}

export class PatientListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'MRN, name or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
