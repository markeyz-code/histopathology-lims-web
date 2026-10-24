import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class Hl7MessageDto {
  @ApiProperty({ description: 'Raw HL7 v2 pipe-delimited message (MLLP wrapping optional)' })
  @IsString()
  @MinLength(10)
  @MaxLength(500_000)
  message!: string;
}
