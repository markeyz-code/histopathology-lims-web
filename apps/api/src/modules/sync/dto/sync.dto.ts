import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SYNC_MUTATION_TYPES, type SyncMutationType } from '@lims/shared';

export class SyncMutationDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  id!: string;

  @ApiProperty({ enum: SYNC_MUTATION_TYPES })
  @IsEnum(SYNC_MUTATION_TYPES)
  type!: SyncMutationType;

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}

export class SyncBatchDto {
  @ApiProperty({ type: [SyncMutationDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations!: SyncMutationDto[];
}
