import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PortalRequestDto {
  @ApiProperty({ example: 'HISTO' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  labCode!: string;

  @ApiProperty({ example: 'referrer@clinic.ng' })
  @IsEmail()
  @MaxLength(160)
  email!: string;
}

export class PortalVerifyDto {
  @ApiProperty({ example: 'HISTO' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  labCode!: string;

  @ApiProperty({ example: 'referrer@clinic.ng' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Matches(/^\d{6}$/)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token?: string;
}
