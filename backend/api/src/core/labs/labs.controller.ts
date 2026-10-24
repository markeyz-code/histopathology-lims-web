import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Lab as LabDto } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateLabDto } from './dto/update-lab.dto';
import { LabsService } from './labs.service';

@ApiTags('Laboratories')
@ApiBearerAuth()
@Controller('labs')
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current laboratory and its settings' })
  getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<LabDto> {
    return this.labsService.getById(user.labId);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update laboratory identity, accession format and TAT settings' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateLabDto): Promise<LabDto> {
    return this.labsService.update(user.labId, dto);
  }
}
