import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty()
  @IsMongoId()
  protocolId!: string;
}

export class UpdateReportDto {
  @ApiProperty({ type: Object, description: 'Field key → value map for the protocol' })
  @IsObject()
  data!: Record<string, unknown>;
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
}
