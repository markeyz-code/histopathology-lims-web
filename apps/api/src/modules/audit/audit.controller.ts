import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dto/audit-list-query.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('LAB_ADMIN', 'SUPER_ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List append-only audit records with filters' })
  list(@Query() query: AuditListQueryDto) {
    return this.auditService.list(query);
  }
}
