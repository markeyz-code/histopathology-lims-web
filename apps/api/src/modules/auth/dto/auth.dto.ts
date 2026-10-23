import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'HISTO' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  labCode!: string;

  @ApiProperty({ example: 'pathologist@histo.ng' })
  @IsEmail()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({ example: 'Pathologist#2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
