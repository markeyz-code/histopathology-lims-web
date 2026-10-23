import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import {
  DISCIPLINES,
  TEST_REQUEST_STATUSES,
  type Discipline,
  type TestRequestStatus,
} from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TestRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @ApiPropertyOptional({ enum: DISCIPLINES })
  @IsOptional()
  @IsEnum(DISCIPLINES)
  discipline?: Discipline;

  @ApiPropertyOptional({ enum: TEST_REQUEST_STATUSES })
  @IsOptional()
  @IsEnum(TEST_REQUEST_STATUSES)
  status?: TestRequestStatus;
}
