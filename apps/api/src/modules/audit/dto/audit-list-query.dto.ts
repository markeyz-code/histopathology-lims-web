import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AUDIT_ACTIONS, type AuditAction } from '@lims/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AuditListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsEnum(AUDIT_ACTIONS)
  action?: AuditAction;

  @ApiPropertyOptional({ example: 'Case' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T.*)?$/, { message: 'from must be an ISO date.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T.*)?$/, { message: 'to must be an ISO date.' })
  to?: string;
}
