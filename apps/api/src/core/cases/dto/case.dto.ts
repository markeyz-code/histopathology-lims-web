import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CASE_STATUSES,
  DISCIPLINES,
  LATERALITIES,
  PRIORITIES,
  type CaseStatus,
  type Discipline,
  type Laterality,
  type Priority,
} from '@lims/shared';
import { CreatePatientDto } from '../../patients/dto/patient.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ReferringClinicianDto {
  @ApiProperty({ example: 'Dr Bola Adeyemi' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'St Mary\u2019s Clinic, Ikeja' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  facility?: string;

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
}

export class SpecimenInputDto {
  @ApiProperty({ example: 'Core biopsy' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  specimenType!: string;

  @ApiProperty({ example: 'Left breast, upper outer quadrant' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  site!: string;

  @ApiPropertyOptional({ enum: LATERALITIES })
  @IsOptional()
  @IsEnum(LATERALITIES)
  laterality?: Laterality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  collectedAt?: string;
}

export class AccessionDto {
  @ApiProperty({ type: CreatePatientDto })
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient!: CreatePatientDto;

  @ApiProperty({ type: ReferringClinicianDto })
  @ValidateNested()
  @Type(() => ReferringClinicianDto)
  referringClinician!: ReferringClinicianDto;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(5_000)
  clinicalHistory!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  clinicalDiagnosis?: string;

  @ApiProperty({ enum: PRIORITIES })
  @IsEnum(PRIORITIES)
  priority!: Priority;

  @ApiPropertyOptional({ enum: DISCIPLINES, default: 'HISTOPATHOLOGY' })
  @IsOptional()
  @IsEnum(DISCIPLINES)
  discipline?: Discipline;

  @ApiPropertyOptional({ example: 'HISTO' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  testCode?: string;

  @ApiPropertyOptional({ example: 'Histopathology examination' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  testName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subspecialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedPathologistId?: string;

  @ApiProperty({ type: [SpecimenInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SpecimenInputDto)
  specimens!: SpecimenInputDto[];
}

export class UpdateCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(5_000)
  clinicalHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  clinicalDiagnosis?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subspecialty?: string;
}

export class AssignCaseDto {
  @ApiPropertyOptional({ nullable: true, description: 'Pass null to unassign.' })
  @IsOptional()
  @IsMongoId()
  pathologistId?: string | null;
}

export class CaseListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Accession number, patient name or MRN' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: CASE_STATUSES })
  @IsOptional()
  @IsEnum(CASE_STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  pathologistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subspecialty?: string;

  @ApiPropertyOptional({ enum: DISCIPLINES })
  @IsOptional()
  @IsEnum(DISCIPLINES)
  discipline?: Discipline;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
