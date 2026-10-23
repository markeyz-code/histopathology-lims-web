import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SpecimenListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  caseId?: string;
}

export class RejectSpecimenDto {
  @ApiPropertyOptional({ example: 'Container leaked; tissue uninterpretable.' })
  @IsString()
  @MinLength(5)
  @MaxLength(1_000)
  reason!: string;
}
