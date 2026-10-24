import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FhirSearchDto {
  @ApiPropertyOptional({ description: 'FHIR resource id' })
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @ApiPropertyOptional({ description: 'MRN, accession, barcode or verification code' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  identifier?: string;

  @ApiPropertyOptional({ description: 'Patient/{id}' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  date?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  _count?: number;
}
